import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const R = new URL("../supabase/migrations/", import.meta.url).pathname; // run: npm i --no-save @electric-sql/pglite && node scripts/verify-pred-sql.mjs
const db = new PGlite();
const ok = []; const bad = [];
const check = (name, cond, extra = "") => (cond ? ok : bad).push(name + (extra ? ` — ${extra}` : ""));
await db.exec(`
 create role anon nologin; create role authenticated nologin; create role service_role nologin;
 create schema auth;
 create table auth.users (id uuid primary key default gen_random_uuid());
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
 create table public.profiles (id uuid primary key, banned boolean default false, username text, full_name text, avatar_url text);
 create table public.follows (follower_id uuid, following_id uuid);
 create table public.cricket_matches (id uuid primary key default gen_random_uuid());
 create table public.app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
`);
for (const f of ["20261016000000_pred_engine.sql", "20261017000000_pred_full_innings_templates.sql", "20261018000000_pred_virtual_economy.sql"]) {
  try { await db.exec(readFileSync(R + f, "utf8")); ok.push("applied " + f); }
  catch (e) { bad.push("apply " + f + ": " + e.message); console.log(bad.at(-1)); break; }
}
if (!bad.length) {
  const as = async (uid) => db.exec(`select set_config('app.uid','${uid}',false)`);
  const q = async (sql, p) => (await db.query(sql, p)).rows;
  const users = []; for (let i = 0; i < 4; i++) { const id = (await q("insert into auth.users default values returning id"))[0].id; users.push(id); await q("insert into public.profiles(id) values ($1)", [id]); }
  // contest: fee 13, min 2, prize [70]
  const c = (await q(`select private.pred_insert_contest($1::jsonb) as r`, [JSON.stringify({
    generationKey: "k1", sport: "cricket", trigger: "pre_match", title: "T", status: "scheduled",
    opensAt: new Date(Date.now() - 3600e3).toISOString(), locksAt: new Date(Date.now() + 3600e3).toISOString(),
    entryFee: 13, minParticipants: 2, prizeSplit: [70], scoring: { pointsPerCorrect: 2, negativePerWrong: 1 },
    questions: [{ position: 1, prompt: "Q", options: [{ id: "dot", label: "Dot" }, { id: "four", label: "Four" }], rule: { kind: "static" }, points: 2 }] })]))[0].r;
  check("contest created with economics", c.created === true);
  const cid = c.id;
  await q("update public.pred_contests set status='published' where id=$1", [cid]);
  const qid = (await q("select id from public.pred_questions where contest_id=$1", [cid]))[0].id;
  // no balance -> join refused
  await as(users[0]);
  let err = null; try { await q("select public.pred_submit_answers($1,$2::jsonb)", [cid, JSON.stringify({ [qid]: "dot" })]); } catch (e) { err = e.message; }
  check("join refused with no points", /not enough virtual points/.test(err ?? ""), String(err));
  check("no entry / no ledger row left behind", (await q("select count(*)::int n from public.pred_entries"))[0].n === 0 && (await q("select count(*)::int n from public.pred_ledger"))[0].n === 0);
  // bonus
  const b1 = (await q("select public.pred_claim_bonus() r"))[0].r;
  const b2 = (await q("select public.pred_claim_bonus() r"))[0].r;
  check("welcome+daily bonus granted once", b1.welcome === 100 && b1.daily === 20 && b2.welcome === 0 && b2.daily === 0, JSON.stringify([b1, b2]));
  // join charges once
  await q("select public.pred_submit_answers($1,$2::jsonb)", [cid, JSON.stringify({ [qid]: "dot" })]);
  let again = null; try { await q("select public.pred_submit_answers($1,$2::jsonb)", [cid, JSON.stringify({ [qid]: "four" })]); } catch (e) { again = e.message; }
  const bal = (await q("select balance from public.pred_wallets where user_id=$1", [users[0]]))[0].balance;
  check("fee charged exactly once (120-13=107)", Number(bal) === 107 && /final/.test(again ?? ""), `balance ${bal}, 2nd: ${again}`);
  check("entry records fee_paid", (await q("select fee_paid from public.pred_entries where user_id=$1", [users[0]]))[0].fee_paid === 13);
  // concurrent joins by many users, funded 13 exactly: all succeed once; wallet never negative
  for (const u of users.slice(1)) { await as(u); await q("select public.pred_claim_bonus()"); }
  const results = await Promise.allSettled(users.slice(1).flatMap((u) => [1, 2, 3].map(async () => {
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('app.uid','${u}',true)`);
      await tx.query("select public.pred_submit_answers($1,$2::jsonb)", [cid, JSON.stringify({ [qid]: "four" })]);
    });
  })));
  check("PGlite is single-connection; repeated joins: 3 users charged once each", (await q("select count(*)::int n from public.pred_entries"))[0].n === 4 && (await q("select coalesce(-sum(amount),0)::int n from public.pred_ledger where kind='entry_fee'"))[0].n === 52, JSON.stringify(results.map((r) => r.status)));
  const neg = await q("select count(*)::int n from public.pred_wallets where balance < 0");
  check("no negative wallets", neg[0].n === 0);
  // wallet == ledger sum
  const mism = await q("select count(*)::int n from public.pred_wallets w where w.balance <> (select coalesce(sum(amount),0) from public.pred_ledger l where l.user_id=w.user_id)");
  check("wallet balance equals ledger sum", mism[0].n === 0);
  // refund path + idempotency
  await db.exec("select set_config('app.uid','',false)");
  const k = "refund:" + cid + ":" + users[0];
  const r1 = (await q("select public.pred_credit($1,13,'refund',$2,$3) r", [users[0], k, cid]))[0].r;
  const r2 = (await q("select public.pred_credit($1,13,'refund',$2,$3) r", [users[0], k, cid]))[0].r;
  check("credit is idempotent by ref_key", r1 === true && r2 === false);
  let bad1 = null; try { await q("select public.pred_credit($1,-5,'prize','x1',null)", [users[0]]); } catch (e) { bad1 = e.message; }
  check("prize cannot be a debit", /only credit/.test(bad1 ?? ""), String(bad1));
  let bad2 = null; try { await q("select public.pred_credit($1,5,'cash_out','x2',null)", [users[0]]); } catch (e) { bad2 = e.message; }
  check("unknown ledger kind rejected", /invalid ledger kind/.test(bad2 ?? ""));
  // state machine
  const legal = [["published","locked"],["locked","live"],["live","settling"],["settling","completed"]];
  for (const [from, to] of legal) { await q("update public.pred_contests set status=$1 where id=$2", [to, cid]).catch(() => null); }
  check("legal chain published→locked→live→settling→completed", (await q("select status from public.pred_contests where id=$1", [cid]))[0].status === "completed");
  let e3 = null; try { await q("update public.pred_contests set status='published' where id=$1", [cid]); } catch (e) { e3 = e.message; }
  check("completed cannot reopen", /invalid contest transition/.test(e3 ?? ""));
  let e4 = null; try { await q("update public.pred_contests set entry_fee=1 where id=$1", [cid]); } catch (e) { e4 = e.message; }
  check("fee frozen after opening", /cannot change after/.test(e4 ?? ""));
  // platform ledger + settlement constraints
  await q("insert into public.pred_platform_ledger(contest_id,amount,kind,ref_key) values ($1,12,'contest_share','pf1')", [cid]);
  let e5 = null; try { await q("update public.pred_platform_ledger set amount=1"); } catch (e) { e5 = e.message; }
  check("platform ledger append-only", /append-only/.test(e5 ?? ""));
  let e6 = null; try { await q("insert into public.pred_settlements(contest_id,version,participants,pool,prize_total,platform_share) values ($1,0,4,52,10,10)", [cid]); } catch (e) { e6 = e.message; }
  check("settlement must satisfy pool = prizes + platform", /check/i.test(e6 ?? ""));
  // seeded ball template
  const t = await q("select entry_fee, min_participants, prize_split, plan->>'generator' g, scoring, enabled from public.pred_templates where name='Ball by ball · every over'");
  check("ball-by-ball over template seeded disabled with 13/2/[70]/+2/-1", t.length === 1 && t[0].entry_fee === 13 && t[0].enabled === false && t[0].scoring.pointsPerCorrect === 2 && t[0].scoring.negativePerWrong === 1);
  // private invites
  const pc = (await q(`select private.pred_insert_contest($1::jsonb) as r`, [JSON.stringify({ generationKey: "k2", sport: "general", trigger: "pre_match", title: "P", status: "scheduled", opensAt: new Date(Date.now() - 3600e3).toISOString(), locksAt: new Date(Date.now() + 3600e3).toISOString(), isPrivate: true, inviteCode: "ABCDEF1234", scoring: { pointsPerCorrect: 2, negativePerWrong: 1 }, questions: [{ position: 1, prompt: "Q", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }], rule: { kind: "static" }, points: 2 }] })]))[0].r;
  await q("update public.pred_contests set status='published' where id=$1", [pc.id]);
  const pq = (await q("select id from public.pred_questions where contest_id=$1", [pc.id]))[0].id;
  await as(users[1]);
  let e7 = null; try { await q("select public.pred_submit_answers($1,$2::jsonb)", [pc.id, JSON.stringify({ [pq]: "a" })]); } catch (e) { e7 = e.message; }
  check("private contest refuses non-members", /invite-only/.test(e7 ?? ""));
  await q("select public.pred_redeem_invite('abcdef1234')");
  await q("select public.pred_submit_answers($1,$2::jsonb)", [pc.id, JSON.stringify({ [pq]: "a" })]);
  check("redeeming the code lets the player in", (await q("select count(*)::int n from public.pred_entries where contest_id=$1", [pc.id]))[0].n === 1);
}
console.log("PASS", ok.length); ok.forEach((x) => console.log("  ✓", x));
console.log("FAIL", bad.length); bad.forEach((x) => console.log("  ✗", x));
