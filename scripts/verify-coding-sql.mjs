// Verifies 20261020000002_coding_contests.sql: hidden tests are unreadable to students; submissions are private.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
await db.exec(`
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
  create role anon; create role authenticated; create role service_role;
  create table public.contests (id uuid primary key default gen_random_uuid(), active boolean default true);
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated; grant select on public.contests to anon, authenticated;
`);
const sql = readFileSync("supabase/migrations/20261020000002_coding_contests.sql", "utf8");
await db.exec(sql); await db.exec(sql);
const A = "00000000-0000-0000-0000-00000000000a", B = "00000000-0000-0000-0000-00000000000b", C = "00000000-0000-0000-0000-0000000000c1", P = "00000000-0000-0000-0000-0000000000f1";
await db.exec(`insert into auth.users values ('${A}'),('${B}'); insert into public.contests (id) values ('${C}');
 insert into public.coding_problems (id, contest_id, title, statement) values ('${P}','${C}','Sum two','Add two numbers please');
 insert into public.coding_testcases (problem_id, input, expected_output) values ('${P}','1 2','3');
 insert into public.coding_submissions (user_id, problem_id, contest_id, language, source_code) values ('${A}','${P}','${C}','python','print(3)'),('${B}','${P}','${C}','python','print(4)');`);
const out = []; const fails = async (s) => { try { await db.exec(s); return false; } catch { return true; } };
await db.exec(`set app.uid='${A}'; set role authenticated;`);
out.push(["student cannot read hidden test cases", await fails(`select * from public.coding_testcases`)]);
out.push(["student reads problem statement", (await db.query(`select id from public.coding_problems`)).rows.length === 1]);
out.push(["student sees only own submissions", (await db.query(`select id from public.coding_submissions`)).rows.length === 1]);
out.push(["student cannot insert submission directly", await fails(`insert into public.coding_submissions (user_id, problem_id, contest_id, language, source_code, status) values ('${A}','${P}','${C}','python','x','accepted')`)]);
out.push(["student cannot edit own verdict", await fails(`update public.coding_submissions set status='accepted', score=999`)]);
await db.exec(`reset role; set role anon;`);
out.push(["anon cannot read submissions", await fails(`select * from public.coding_submissions`)]);
await db.exec(`reset role; update public.contests set active=false; set role authenticated;`);
out.push(["inactive contest hides problems", (await db.query(`select id from public.coding_problems`)).rows.length === 0]);
let f = 0; for (const [n, ok] of out) { console.log(ok ? "PASS" : "FAIL", n); if (!ok) f++; }
process.exit(f ? 1 : 0);
