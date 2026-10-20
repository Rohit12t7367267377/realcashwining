// Verifies 20261020000001_contest_marking.sql: NULL marking keeps global behaviour; exam marking (+4/-1) scores correctly.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
await db.exec(`
  create role service_role;
  create table public.app_settings (key text primary key, value jsonb);
  insert into public.app_settings values ('correct_points','1'),('wrong_points','0');
  create table public.contests (id uuid primary key default gen_random_uuid(), category_id uuid, num_questions int);
  create table public.questions (id uuid primary key default gen_random_uuid(), category_id uuid, correct_index int, created_at timestamptz default clock_timestamp());
  create table public.contest_attempts (id uuid primary key default gen_random_uuid(), contest_id uuid, answers jsonb, score numeric);
`);
await db.exec(readFileSync("supabase/migrations/20261020000001_contest_marking.sql", "utf8"));
await db.exec(readFileSync("supabase/migrations/20261020000001_contest_marking.sql", "utf8")); // re-runnable
const cat = "00000000-0000-0000-0000-0000000000c1", legacy = "00000000-0000-0000-0000-0000000000d1", exam = "00000000-0000-0000-0000-0000000000d2";
await db.exec(`insert into public.questions (category_id, correct_index) values ('${cat}',0),('${cat}',1),('${cat}',2),('${cat}',3);
 insert into public.contests values ('${legacy}','${cat}',4);
 insert into public.contests (id, category_id, num_questions, marks_correct, marks_wrong) values ('${exam}','${cat}',4,4,-1);
 insert into public.contest_attempts (contest_id, answers) values ('${legacy}','[0,1,0,null]'),('${exam}','[0,1,0,null]');`);
await db.exec(`select public.auto_score_contest('${legacy}'); select public.auto_score_contest('${exam}');`);
const q = async (id) => Number((await db.query(`select score from public.contest_attempts where contest_id='${id}'`)).rows[0].score);
const out = [["legacy contest unchanged (2 correct => 2)", (await q(legacy)) === 2], ["exam +4/-1 (2 correct,1 wrong => 7)", (await q(exam)) === 7]];
let bad = false; try { await db.exec(`update public.contests set marks_wrong = 5`); } catch { bad = true; }
out.push(["positive wrong-marks rejected", bad]);
let f = 0; for (const [n, ok] of out) { console.log(ok ? "PASS" : "FAIL", n); if (!ok) f++; }
process.exit(f ? 1 : 0);
