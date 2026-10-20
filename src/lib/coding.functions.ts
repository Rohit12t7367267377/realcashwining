// Coding & DSA contest server functions. Students submit; the external judge scores. Hidden tests, expected
// outputs and other users' code never leave the server.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeContestAudit } from "@/lib/contest-admin.functions";
import { aggregate, problemSchema, rankCoding, submitSchema, SUBMIT_LIMIT, testcaseSchema, type Language } from "@/lib/coding";

const admin = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const MAX_CASES = 40;

async function runJudge(submissionId: string) {
  const { judgeSubmission, judgeConfigFromEnv } = await import("@/lib/coding-judge.server");
  const { data: sub } = await admin.from("coding_submissions").select("*").eq("id", submissionId).maybeSingle();
  if (!sub) throw new Error("Submission not found");
  const { data: prob } = await admin.from("coding_problems").select("points, time_limit_ms, memory_limit_mb").eq("id", sub.problem_id).maybeSingle();
  const { data: cases } = await admin.from("coding_testcases").select("input, expected_output, weight").eq("problem_id", sub.problem_id).order("sort_order").limit(MAX_CASES);
  if (!prob || !cases?.length) {
    await admin.from("coding_submissions").update({ status: "internal_error", detail: { error: "Problem has no test cases yet" }, judged_at: new Date().toISOString() }).eq("id", submissionId);
    return { verdict: "internal_error" as const, passed: 0, total: 0, score: 0, message: "This problem has no test cases yet." };
  }
  await admin.from("coding_submissions").update({ status: "running" }).eq("id", submissionId);
  const { results, compileOutput } = await judgeSubmission({
    language: sub.language as Language, source: sub.source_code, timeLimitMs: prob.time_limit_ms, memoryLimitMb: prob.memory_limit_mb,
    cases: (cases as any[]).map((c) => ({ input: c.input, expectedOutput: c.expected_output, weight: c.weight })),
  }, judgeConfigFromEnv());
  const agg = aggregate(results, Number(prob.points));
  await admin.from("coding_submissions").update({
    status: agg.verdict, passed: agg.passed, total: cases.length, score: agg.score, judged_at: new Date().toISOString(),
    // Per-case verdicts only: never the hidden input or expected output.
    detail: { cases: results.map(({ index, verdict, timeMs, memoryKb }) => ({ index, verdict, timeMs, memoryKb })), compileOutput: compileOutput ?? null },
  }).eq("id", submissionId);
  return { verdict: agg.verdict, passed: agg.passed, total: cases.length, score: agg.score, compileOutput: compileOutput ?? null,
    message: agg.verdict === "judge_unavailable" ? "The code judge is not available right now. Your submission is saved; try again later." : null };
}

export const listCodingProblems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const [{ data: contest }, { data: problems }, { data: mine }] = await Promise.all([
      sb.from("contests").select("id, title, starts_at, ends_at, active, duration_minutes").eq("id", data.contestId).maybeSingle(),
      sb.from("coding_problems").select("id, title, statement, input_format, output_format, constraints_text, sample_input, sample_output, difficulty, points, time_limit_ms, memory_limit_mb, sort_order").eq("contest_id", data.contestId).order("sort_order"),
      sb.from("coding_submissions").select("id, problem_id, language, status, passed, total, score, created_at").eq("contest_id", data.contestId).order("created_at", { ascending: false }).limit(100),
    ]);
    return { contest: contest ?? null, problems: problems ?? [], submissions: mine ?? [] };
  });

export const submitCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => submitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: prob } = await admin.from("coding_problems").select("id, contest_id, active").eq("id", data.problemId).maybeSingle();
    if (!prob || !prob.active) throw new Error("Problem not found");
    const { data: contest } = await admin.from("contests").select("id, active, starts_at, ends_at, entry_fee").eq("id", prob.contest_id).maybeSingle();
    if (!contest?.active) throw new Error("This contest is not open");
    if (Number(contest.entry_fee) > 0) throw new Error("Paid coding contests are not enabled");
    const now = Date.now();
    if (contest.starts_at && new Date(contest.starts_at).getTime() > now) throw new Error("This contest has not started yet");
    if (contest.ends_at && new Date(contest.ends_at).getTime() < now) throw new Error("This contest has ended");
    if (new TextEncoder().encode(data.source).length > 64 * 1024) throw new Error("Source code is too large (64 KB max)");

    const minuteAgo = new Date(now - 60_000).toISOString();
    const hourAgo = new Date(now - 3_600_000).toISOString();
    const [{ count: recent }, { count: perProblem }] = await Promise.all([
      admin.from("coding_submissions").select("id", { count: "exact", head: true }).eq("user_id", context.userId).gte("created_at", minuteAgo),
      admin.from("coding_submissions").select("id", { count: "exact", head: true }).eq("user_id", context.userId).eq("problem_id", data.problemId).gte("created_at", hourAgo),
    ]);
    if ((recent ?? 0) >= SUBMIT_LIMIT.perMinute) throw new Error("Too many submissions. Please wait a minute.");
    if ((perProblem ?? 0) >= SUBMIT_LIMIT.perProblemPerHour) throw new Error("Hourly submission limit reached for this problem.");

    const { data: row, error } = await admin.from("coding_submissions").insert({
      user_id: context.userId, problem_id: data.problemId, contest_id: prob.contest_id, language: data.language, source_code: data.source,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, ...(await runJudge(row.id)) };
  });

export const getCodingLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contestId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: subs } = await admin.from("coding_submissions").select("user_id, problem_id, score, status, created_at").eq("contest_id", data.contestId).limit(20000);
    const rows = rankCoding((subs ?? []).map((s: any) => ({ userId: s.user_id, problemId: s.problem_id, score: Number(s.score), status: s.status, at: new Date(s.created_at).getTime() })));
    const top = rows.slice(0, 100);
    const ids = top.map((r) => r.userId);
    const { data: profiles } = ids.length ? await admin.from("profiles").select("id, username, full_name").in("id", ids) : { data: [] };
    const nm = new Map<string, string>((profiles ?? []).map((p: any) => [p.id, p.username || p.full_name || "Player"]));
    return { me: context.userId, rows: top.map((r) => ({ ...r, name: nm.get(r.userId) ?? "Player" })) };
  });

// ---- Admin ----
export const adminListCoding = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ contestId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const [{ data: problems }, { data: subs }] = await Promise.all([
      admin.from("coding_problems").select("*, coding_testcases(id, weight, sort_order)").eq("contest_id", data.contestId).order("sort_order"),
      admin.from("coding_submissions").select("id, user_id, problem_id, language, status, passed, total, score, created_at").eq("contest_id", data.contestId).order("created_at", { ascending: false }).limit(200),
    ]);
    return { problems: problems ?? [], submissions: subs ?? [], judgeConfigured: Boolean((await import("@/lib/coding-judge.server")).judgeConfigFromEnv().baseUrl) };
  });

export const adminUpsertProblem = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), values: problemSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const v = data.values;
    const { data: c } = await admin.from("contests").select("entry_fee").eq("id", v.contestId).maybeSingle();
    if (!c) throw new Error("Contest not found");
    if (Number(c.entry_fee) > 0) throw new Error("Paid coding contests are not enabled");
    const row = {
      contest_id: v.contestId, title: v.title, statement: v.statement, input_format: v.inputFormat, output_format: v.outputFormat,
      constraints_text: v.constraintsText, sample_input: v.sampleInput, sample_output: v.sampleOutput, difficulty: v.difficulty,
      points: v.points, time_limit_ms: v.timeLimitMs, memory_limit_mb: v.memoryLimitMb, sort_order: v.sortOrder, active: v.active,
    };
    const q = data.id ? admin.from("coding_problems").update(row).eq("id", data.id) : admin.from("coding_problems").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await writeContestAudit(context.adminUserId, data.id ? "coding.problem_update" : "coding.problem_create", "coding_problem", data.id ?? null, { contest_id: v.contestId, title: v.title });
    return { ok: true };
  });

export const adminDeleteProblem = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await admin.from("coding_problems").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeContestAudit(context.adminUserId, "coding.problem_delete", "coding_problem", data.id);
    return { ok: true };
  });

export const adminAddTestcase = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => testcaseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { count } = await admin.from("coding_testcases").select("id", { count: "exact", head: true }).eq("problem_id", data.problemId);
    if ((count ?? 0) >= MAX_CASES) throw new Error(`A problem can have at most ${MAX_CASES} test cases`);
    const { error } = await admin.from("coding_testcases").insert({ problem_id: data.problemId, input: data.input, expected_output: data.expectedOutput, weight: data.weight, sort_order: data.sortOrder });
    if (error) throw new Error(error.message);
    await writeContestAudit(context.adminUserId, "coding.testcase_add", "coding_problem", data.problemId, { weight: data.weight });
    return { ok: true };
  });

export const adminDeleteTestcase = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await admin.from("coding_testcases").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRejudge = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ submissionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await runJudge(data.submissionId);
    await writeContestAudit(context.adminUserId, "coding.rejudge", "coding_submission", data.submissionId, { verdict: r.verdict });
    return r;
  });
