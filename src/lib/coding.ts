import { z } from "zod";

/**
 * Coding & DSA contests: pure logic (languages, verdicts, scoring, ranking, input validation).
 * Nothing here runs user code. Execution happens only in an external isolated judge (see coding-judge.server.ts).
 */
export const LANGUAGES = {
  python: { label: "Python 3", judge0Id: 71 },
  cpp: { label: "C++17", judge0Id: 54 },
  c: { label: "C (GCC)", judge0Id: 50 },
  java: { label: "Java", judge0Id: 62 },
  javascript: { label: "JavaScript (Node)", judge0Id: 63 },
} as const;
export type Language = keyof typeof LANGUAGES;
export const LANGUAGE_KEYS = Object.keys(LANGUAGES) as [Language, ...Language[]];

export const MAX_SOURCE_BYTES = 64 * 1024;
/** Per-user submission throttle (server-enforced). */
export const SUBMIT_LIMIT = { perMinute: 6, perProblemPerHour: 60 };

export const submitSchema = z.object({
  problemId: z.string().uuid(),
  language: z.enum(LANGUAGE_KEYS),
  source: z.string().min(1).max(65536),
});

export type Verdict =
  | "accepted" | "partial" | "wrong_answer" | "time_limit" | "memory_limit"
  | "runtime_error" | "compile_error" | "judge_unavailable" | "internal_error";

/** Normalised comparison: trims trailing whitespace per line and trailing blank lines (standard judge behaviour). */
export function normaliseOutput(s: string): string {
  return s.replace(/\r\n/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/g, "")).join("\n").replace(/\n+$/g, "");
}
export const outputsMatch = (actual: string, expected: string) => normaliseOutput(actual) === normaliseOutput(expected);

export type CaseResult = { index: number; verdict: Verdict; weight: number; timeMs?: number; memoryKb?: number };

/** First failing verdict decides the overall verdict; all-pass is accepted; some-pass without a hard error is partial. */
export function aggregate(results: CaseResult[], points: number) {
  const total = results.reduce((s, r) => s + r.weight, 0);
  const passedW = results.filter((r) => r.verdict === "accepted").reduce((s, r) => s + r.weight, 0);
  const passed = results.filter((r) => r.verdict === "accepted").length;
  const failing = results.find((r) => r.verdict !== "accepted");
  let verdict: Verdict;
  if (results.length === 0) verdict = "internal_error";
  else if (!failing) verdict = "accepted";
  else if (failing.verdict === "compile_error" || failing.verdict === "judge_unavailable" || failing.verdict === "internal_error") verdict = failing.verdict;
  else verdict = passed > 0 ? "partial" : failing.verdict;
  const score = total > 0 && verdict !== "judge_unavailable" && verdict !== "internal_error" && verdict !== "compile_error"
    ? Math.round((passedW / total) * points * 100) / 100 : 0;
  return { verdict, passed, total: results.length, score, failingCase: failing?.index ?? null };
}

export type RankSubmission = { userId: string; problemId: string; score: number; at: number; status: string };
export type RankRow = { userId: string; score: number; solved: number; lastImprovementAt: number; rank: number };

/**
 * Ranking: per user, best score per problem; total desc, then earlier last improvement wins, then userId for a
 * deterministic tie-break. Unjudged/infrastructure failures never count.
 */
export function rankCoding(subs: RankSubmission[]): RankRow[] {
  const best = new Map<string, Map<string, { score: number; at: number; accepted: boolean }>>();
  const sorted = [...subs].sort((a, b) => a.at - b.at);
  for (const s of sorted) {
    if (["queued", "running", "judge_unavailable", "internal_error", "compile_error"].includes(s.status)) continue;
    const m = best.get(s.userId) ?? new Map();
    const cur = m.get(s.problemId);
    if (!cur || s.score > cur.score) m.set(s.problemId, { score: s.score, at: s.at, accepted: s.status === "accepted" });
    best.set(s.userId, m);
  }
  const rows = [...best.entries()].map(([userId, m]) => {
    let score = 0, solved = 0, last = 0;
    for (const v of m.values()) { score += v.score; if (v.accepted) solved++; last = Math.max(last, v.at); }
    return { userId, score: Math.round(score * 100) / 100, solved, lastImprovementAt: last, rank: 0 };
  }).filter((r) => r.score > 0 || r.solved > 0);
  rows.sort((a, b) => b.score - a.score || a.lastImprovementAt - b.lastImprovementAt || a.userId.localeCompare(b.userId));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

export const problemSchema = z.object({
  contestId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  statement: z.string().trim().min(10).max(20000),
  inputFormat: z.string().max(4000).default(""),
  outputFormat: z.string().max(4000).default(""),
  constraintsText: z.string().max(4000).default(""),
  sampleInput: z.string().max(4000).default(""),
  sampleOutput: z.string().max(4000).default(""),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  points: z.number().int().min(1).max(10000).default(100),
  timeLimitMs: z.number().int().min(100).max(15000).default(2000),
  memoryLimitMb: z.number().int().min(16).max(1024).default(256),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

export const testcaseSchema = z.object({
  problemId: z.string().uuid(),
  input: z.string().max(200_000),
  expectedOutput: z.string().min(1).max(200_000),
  weight: z.number().int().min(1).max(1000).default(1),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});
