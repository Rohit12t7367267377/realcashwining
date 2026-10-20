// Verifies 20261020000000_answer_key_privacy.sql on PGlite: students cannot read answer keys
// before submitting, cannot self-complete an attempt, and get the review only after scoring.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
await db.exec(`
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
  create role anon; create role authenticated; create role service_role;
  create function public.has_role(_u uuid, _r text) returns boolean language sql as $$ select false $$;
  create table public.reading_passages (id uuid primary key default gen_random_uuid(), active boolean default true);
  create table public.reading_questions (id uuid primary key default gen_random_uuid(), passage_id uuid not null,
    question text not null, options jsonb not null default '[]', correct_index int not null default 0, explanation text,
    marks numeric, sort_order int not null default 0, created_at timestamptz default now(), updated_at timestamptz default now());
  create table public.reading_attempts (id uuid primary key default gen_random_uuid(), user_id uuid not null, passage_id uuid not null,
    answers jsonb default '[]', score numeric default 0, correct_count int default 0, wrong_count int default 0, unanswered_count int default 0,
    accuracy numeric default 0, quiz_seconds_spent int default 0, status text default 'reading', submitted_at timestamptz);
  grant usage on schema public, auth to anon, authenticated;
  grant select on public.reading_questions to anon, authenticated;
  grant select, insert, update on public.reading_attempts to authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(readFileSync("supabase/migrations/20261020000000_answer_key_privacy.sql", "utf8"));
const U = "00000000-0000-0000-0000-000000000001";
const P = "00000000-0000-0000-0000-0000000000aa";
await db.exec(`insert into public.reading_passages (id) values ('${P}');
 insert into public.reading_questions (passage_id, question, correct_index, explanation) values ('${P}','q1',2,'because');
 insert into public.reading_attempts (id, user_id, passage_id) values ('00000000-0000-0000-0000-0000000000b1','${U}','${P}');`);
const out = [];
const fails = async (sql) => { try { await db.exec(sql); return false; } catch { return true; } };
await db.exec(`set app.uid = '${U}'; set role authenticated;`);
out.push(["student cannot select correct_index", await fails(`select correct_index from public.reading_questions`)]);
out.push(["student cannot select explanation", await fails(`select explanation from public.reading_questions`)]);
out.push(["student can read question+options", !(await fails(`select id, question, options from public.reading_questions`))]);
out.push(["review refused before submit", await fails(`select * from public.get_reading_review('00000000-0000-0000-0000-0000000000b1')`)]);
await db.exec(`update public.reading_attempts set status='completed', submitted_at=now(), score=99`);
out.push(["self-complete via UPDATE refused", await fails(`select * from public.get_reading_review('00000000-0000-0000-0000-0000000000b1')`)]);
await db.exec(`reset role;`);
// scorer runs as owner (definer): simulate completion
await db.exec(`update public.reading_attempts set status='completed', submitted_at=now()`);
await db.exec(`set app.uid = '${U}'; set role authenticated;`);
const r = await db.query(`select * from public.get_reading_review('00000000-0000-0000-0000-0000000000b1')`);
out.push(["review returned after scoring", r.rows.length === 1 && r.rows[0].correct_index === 2]);
await db.exec(`set app.uid = '00000000-0000-0000-0000-000000000002'`);
out.push(["other user cannot read review", await fails(`select * from public.get_reading_review('00000000-0000-0000-0000-0000000000b1')`)]);
let failed = 0; for (const [n, ok] of out) { console.log(ok ? "PASS" : "FAIL", n); if (!ok) failed++; }
process.exit(failed ? 1 : 0);
