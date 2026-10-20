import { describe, expect, it } from "vitest";
import { aggregate, normaliseOutput, outputsMatch, rankCoding, submitSchema, type CaseResult } from "./coding";
import { judgeSubmission, mapJudge0Status } from "./coding-judge.server";

const ok = (i: number, w = 1): CaseResult => ({ index: i, verdict: "accepted", weight: w });
const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("coding verdicts", () => {
  it("normalises whitespace like a judge", () => {
    expect(normaliseOutput("1 2  \r\n3\n\n")).toBe("1 2\n3");
    expect(outputsMatch("42\n", "42")).toBe(true);
    expect(outputsMatch("4 2", "42")).toBe(false);
  });
  it("all pass => accepted with full points", () => {
    expect(aggregate([ok(0), ok(1)], 100)).toMatchObject({ verdict: "accepted", score: 100, passed: 2 });
  });
  it("weighted partial credit and first failing verdict", () => {
    const r = aggregate([ok(0, 3), { index: 1, verdict: "wrong_answer", weight: 1 }], 100);
    expect(r).toMatchObject({ verdict: "partial", score: 75, failingCase: 1 });
    expect(aggregate([{ index: 0, verdict: "time_limit", weight: 1 }, ok(1)], 100).verdict).toBe("partial");
    expect(aggregate([{ index: 0, verdict: "wrong_answer", weight: 1 }], 100)).toMatchObject({ verdict: "wrong_answer", score: 0 });
  });
  it("infrastructure failures and compile errors score zero", () => {
    expect(aggregate([{ index: 0, verdict: "judge_unavailable", weight: 1 }], 100)).toMatchObject({ verdict: "judge_unavailable", score: 0 });
    expect(aggregate([{ index: 0, verdict: "compile_error", weight: 1 }], 100).score).toBe(0);
    expect(aggregate([], 100).verdict).toBe("internal_error");
  });
});

describe("coding ranking", () => {
  const s = (userId: string, problemId: string, score: number, at: number, status = "accepted") => ({ userId, problemId, score, at, status });
  it("uses best score per problem, then earlier last improvement, deterministically", () => {
    const rows = rankCoding([
      s("a", "p1", 50, 1, "partial"), s("a", "p1", 100, 5), s("a", "p1", 20, 9, "partial"),
      s("b", "p1", 100, 3), s("c", "p1", 100, 3),
    ]);
    expect(rows.map((r) => r.userId)).toEqual(["b", "c", "a"]);
    expect(rows[0]!.rank).toBe(1);
    expect(rows.find((r) => r.userId === "a")!.score).toBe(100);
  });
  it("ignores unjudged and infrastructure failures", () => {
    expect(rankCoding([s("a", "p1", 0, 1, "judge_unavailable"), s("b", "p1", 0, 1, "queued"), s("c", "p1", 0, 1, "wrong_answer")])).toEqual([]);
  });
});

describe("judge boundary", () => {
  const base = { language: "python" as const, source: "print(42)", timeLimitMs: 1000, memoryLimitMb: 128 };
  it("never runs anything when no judge is configured", async () => {
    let called = false;
    const r = await judgeSubmission({ ...base, cases: [{ input: "", expectedOutput: "42", weight: 1 }] }, { baseUrl: null }, async () => { called = true; throw new Error("no"); });
    expect(called).toBe(false);
    expect(r.results[0]!.verdict).toBe("judge_unavailable");
  });
  it("sends source to the configured judge and compares output itself", async () => {
    const seen: any[] = [];
    const f = async (_u: string, init: any) => { seen.push(JSON.parse(init.body)); return { ok: true, status: 200, json: async () => ({ status: { id: 3 }, stdout: b64("42\n"), time: "0.01", memory: 1000 }) }; };
    const r = await judgeSubmission({ ...base, cases: [{ input: "x", expectedOutput: "42", weight: 1 }, { input: "y", expectedOutput: "43", weight: 1 }] }, { baseUrl: "https://judge.example" }, f);
    expect(r.results.map((x) => x.verdict)).toEqual(["accepted", "wrong_answer"]);
    expect(seen[0].language_id).toBe(71);
    expect(Buffer.from(seen[0].source_code, "base64").toString()).toBe("print(42)");
    expect(seen[0].cpu_time_limit).toBe(1);
  });
  it("stops on compile error and on network failure", async () => {
    const ce = async () => ({ ok: true, status: 200, json: async () => ({ status: { id: 6 }, compile_output: b64("syntax error") }) });
    const r = await judgeSubmission({ ...base, cases: [{ input: "", expectedOutput: "1", weight: 1 }, { input: "", expectedOutput: "1", weight: 1 }] }, { baseUrl: "https://j.example" }, ce);
    expect(r.results).toHaveLength(1);
    expect(r.compileOutput).toBe("syntax error");
    const down = await judgeSubmission({ ...base, cases: [{ input: "", expectedOutput: "1", weight: 1 }] }, { baseUrl: "https://j.example" }, async () => { throw new Error("net"); });
    expect(down.results[0]!.verdict).toBe("judge_unavailable");
  });
  it("maps judge statuses", () => {
    expect([3, 5, 6, 11, 13].map(mapJudge0Status)).toEqual(["accepted", "time_limit", "compile_error", "runtime_error", "internal_error"]);
  });
  it("validates submissions", () => {
    expect(submitSchema.safeParse({ problemId: crypto.randomUUID(), language: "rust", source: "x" }).success).toBe(false);
    expect(submitSchema.safeParse({ problemId: crypto.randomUUID(), language: "python", source: "x".repeat(70000) }).success).toBe(false);
  });
});
