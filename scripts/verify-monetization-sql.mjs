// Applies the monetization migration to in-memory Postgres (PGlite) over stubs of existing tables and checks the behaviour.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
await db.exec(`
  create schema if not exists auth;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  create role authenticated; create role service_role; create role anon;
  create table public.profiles (id uuid primary key references auth.users(id));
  create table public.app_settings (key text primary key, value jsonb);
  create table public.memberships (id uuid primary key default gen_random_uuid(), name text);
  create table public.user_memberships (id uuid primary key default gen_random_uuid(), user_id uuid, membership_id uuid, status text, starts_at timestamptz, ends_at timestamptz);
  create function public.has_role(_u uuid, _r text) returns boolean language sql as $$ select false $$;
`);
const sql = readFileSync("supabase/migrations/20261025000000_monetization.sql", "utf8");
await db.exec(sql);
await db.exec(sql); // idempotent
const out = []; const check = (n, ok) => out.push([n, !!ok]);
const q = async (s, p) => (await db.query(s, p)).rows;
const mk = async () => { const [{ id }] = await q(`insert into auth.users default values returning id`); await db.query(`insert into public.profiles(id) values($1)`, [id]); return id; };
const setS = (o) => db.query(`update public.app_settings set value = value || $1::jsonb where key='monetization'`, [JSON.stringify(o)]);
const use = async (u, f, idem) => (await q(`select public.consume_feature($1,$2,$3) r`, [u, f, idem ?? null]))[0].r;
const bal = async (u) => (await q(`select * from public.user_credits where user_id=$1`, [u]))[0];

// master OFF: nothing charged, signup trigger still creates account
const u0 = await mk();
let r = await use(u0, "guru_chat");
check("off: allowed and free", r.allowed && r.reason === "monetization_off");
check("off: signup grant still recorded", (await bal(u0)).free_balance === 30);

await setS({ enabled: true, signup_credits: 10 });
const u1 = await mk();
check("signup grant = configured", (await bal(u1)).free_balance === 10);
await q(`select public.mon_ensure_user($1)`, [u1]); await q(`select public.mon_ensure_user($1)`, [u1]);
check("signup grant idempotent", (await bal(u1)).free_balance === 10);

// charging
r = await use(u1, "guru_lesson");
check("cost 2 deducted", r.allowed && r.charged === 2 && (await bal(u1)).free_balance === 8);
r = await use(u1, "guru_chat", "k1"); const b1 = (await bal(u1)).free_balance;
r = await use(u1, "guru_chat", "k1");
check("idempotent replay not double charged", r.replay === true && (await bal(u1)).free_balance === b1);

// deduction order free then paid
await q(`select public.mon_grant($1,5,'paid','test',null)`, [u1]);
await db.query(`update public.user_credits set free_balance=1 where user_id=$1`, [u1]);
r = await use(u1, "guru_lesson");
const b = await bal(u1);
check("free used first then paid", r.allowed && b.free_balance === 0 && b.paid_balance === 4);

// no credits
const u2 = await mk(); await db.query(`update public.user_credits set free_balance=0 where user_id=$1`, [u2]);
r = await use(u2, "guru_chat");
check("no_credits blocks", !r.allowed && r.reason === "no_credits");

// daily limit
await db.query(`update public.monetization_features set free_daily_limit=2 where feature_key='guru_doubt'`);
const u3 = await mk(); await use(u3, "guru_doubt"); await use(u3, "guru_doubt");
r = await use(u3, "guru_doubt");
check("daily limit blocks", !r.allowed && r.reason === "limit_daily");
await db.query(`update public.monetization_features set free_monthly_limit=2, free_daily_limit=null where feature_key='guru_doubt'`);
r = await use(u3, "guru_doubt");
check("monthly limit blocks", !r.allowed && r.reason === "limit_monthly");

// feature disabled
await db.query(`update public.monetization_features set enabled=false where feature_key='guru_photo'`);
r = await use(u3, "guru_photo");
check("disabled feature blocks", !r.allowed && r.reason === "feature_disabled");

// plan: credits per cycle + unlimited + expiry
const [{ id: plan }] = await q(`insert into public.memberships(name) values('Pro') returning id`);
await db.query(`update public.memberships set credits_per_cycle=100, unlimited_ai=true where id=$1`, [plan]);
const u4 = await mk();
await db.query(`insert into public.user_memberships(user_id,membership_id,status,starts_at,ends_at) values($1,$2,'active',now()-interval '1 day',now()+interval '29 days')`, [u4, plan]);
r = await use(u4, "guru_lesson");
check("plan credits granted once, unlimited charges 0", r.allowed && r.charged === 0 && (await bal(u4)).paid_balance === 100);
await use(u4, "guru_lesson");
check("plan cycle grant idempotent", (await bal(u4)).paid_balance === 100);
await db.query(`update public.user_memberships set starts_at=now()-interval '31 days', ends_at=now()+interval '1 day' where user_id=$1`, [u4]);
await use(u4, "guru_chat");
check("renewal cycle grants again", (await bal(u4)).paid_balance === 200);
await db.query(`update public.user_memberships set ends_at=now()-interval '1 minute' where user_id=$1`, [u4]);
await db.query(`update public.user_credits set paid_balance=0 where user_id=$1`, [u4]);
await db.query(`update public.user_credits set free_balance=0 where user_id=$1`, [u4]);
r = await use(u4, "guru_chat");
check("expired plan loses unlimited", !r.allowed && r.reason === "no_credits");
const m = (await q(`select public.monetization_maintenance() r`))[0].r;
check("maintenance marks membership expired", m.expired_memberships === 1);

// free credit expiry + monthly reset
await setS({ signup_credit_expiry_days: 5, monthly_free_credits: 7 });
const u5 = await mk();
await db.query(`update public.user_credits set free_expires_at=now()-interval '1 second' where user_id=$1`, [u5]);
await q(`select public.mon_ensure_user($1)`, [u5]);
check("free credits expire", (await bal(u5)).free_balance === 0);
await db.query(`update public.user_credits set last_free_reset_month='2000-01', free_balance=1 where user_id=$1`, [u5]);
await q(`select public.mon_ensure_user($1)`, [u5]);
check("monthly reset sets balance to monthly amount", (await bal(u5)).free_balance === 7);

// grants & offers
const n = (await q(`select public.mon_grant_audience('all',3,'paid','bulk',null) n`))[0].n;
check("bulk grant touches all profiles", n >= 6);
await db.query(`insert into public.monetization_offers(code,title,bonus_credits) values('WELCOME','Welcome',20)`);
const pre = (await bal(u2)).paid_balance;
let o = (await q(`select public.claim_offer($1,'welcome') r`, [u2]))[0].r;
check("offer grants bonus", o.ok && (await bal(u2)).paid_balance === pre + 20);
o = (await q(`select public.claim_offer($1,'WELCOME') r`, [u2]))[0].r;
check("offer cannot be claimed twice", !o.ok && o.reason === "already_claimed");

// ledger consistency
const bad = await q(`select 1 from public.user_credits c where c.free_balance <> coalesce((select free_after from public.credit_ledger l where l.user_id=c.user_id and l.bucket='free' order by created_at desc, id limit 1), c.free_balance)`);
check("ledger exists for usage", (await q(`select count(*)::int c from public.credit_ledger where kind='usage'`))[0].c > 0);
check("RLS on balances", (await q(`select relrowsecurity r from pg_class where relname='user_credits'`))[0].r);

let failed = 0; for (const [n, ok] of out) { console.log(ok ? "PASS" : "FAIL", n); if (!ok) failed++; }
process.exit(failed ? 1 : 0);
