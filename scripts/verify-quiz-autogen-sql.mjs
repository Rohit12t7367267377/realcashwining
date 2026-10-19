// Applies the quiz-autogen migration to an in-memory Postgres (PGlite) on top of minimal stubs of the
// existing tables it extends, then checks idempotent re-run, slot uniqueness and the run-log constraints.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
await db.exec(`
  create schema if not exists auth;
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  create role authenticated; create role service_role;
  create table public.contests (id uuid primary key default gen_random_uuid(), title text not null);
  create function public.has_role(_u uuid, _r text) returns boolean language sql as $$ select false $$;
`);
const sql = readFileSync("supabase/migrations/20261019000000_quiz_autogen.sql", "utf8");
await db.exec(sql);
await db.exec(sql); // must be safe to re-run
const out = [];
const check = (name, ok) => { out.push([name, ok]); };
await db.exec(`insert into public.contests (title, auto_slot_key) values ('a','school:60:1')`);
let dup = false; try { await db.exec(`insert into public.contests (title, auto_slot_key) values ('b','school:60:1')`); } catch { dup = true; }
check("duplicate auto_slot_key rejected", dup);
await db.exec(`insert into public.contests (title) values ('manual1'),('manual2')`);
check("manual contests (NULL slot key) unaffected", true);
await db.exec(`insert into public.quiz_autogen_runs (slot_key) values ('s1')`);
let dupRun = false; try { await db.exec(`insert into public.quiz_autogen_runs (slot_key) values ('s1')`); } catch { dupRun = true; }
check("duplicate run slot rejected", dupRun);
let badStatus = false; try { await db.exec(`update public.quiz_autogen_runs set status='bogus'`); } catch { badStatus = true; }
check("invalid run status rejected", badStatus);
const rls = await db.query(`select relrowsecurity from pg_class where relname='quiz_autogen_runs'`);
check("RLS enabled on run log", rls.rows[0]?.relrowsecurity === true);
let failed = 0; for (const [n, ok] of out) { console.log(ok ? "PASS" : "FAIL", n); if (!ok) failed++; }
process.exit(failed ? 1 : 0);
