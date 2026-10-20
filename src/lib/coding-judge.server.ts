/**
 * The ONLY place coding submissions are executed — and it never executes anything locally. Source code is
 * sent over HTTPS to an external, isolated Judge0-compatible service (JUDGE0_URL, optional JUDGE0_AUTH_TOKEN).
 * If no judge is configured, or it cannot be reached, the result is an honest "judge_unavailable".
 */
import { LANGUAGES, outputsMatch, type CaseResult, type Language, type Verdict } from "@/lib/coding";

export type JudgeConfig = { baseUrl: string | null; token?: string | null };
export type JudgeCase = { input: string; expectedOutput: string; weight: number };
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function judgeConfigFromEnv(): JudgeConfig {
  const baseUrl = (process.env.JUDGE0_URL ?? "").trim().replace(/\/+$/, "");
  return { baseUrl: /^https:\/\//.test(baseUrl) ? baseUrl : null, token: process.env.JUDGE0_AUTH_TOKEN ?? null };
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s: unknown) => (typeof s === "string" && s ? Buffer.from(s, "base64").toString("utf8") : "");

/** Judge0 status ids -> our verdicts (3 = ran OK; output is compared by us). */
export function mapJudge0Status(id: number): Verdict {
  if (id === 3) return "accepted";
  if (id === 5) return "time_limit";
  if (id === 6) return "compile_error";
  if (id >= 7 && id <= 12) return "runtime_error";
  if (id === 4) return "wrong_answer";
  return "internal_error";
}

export async function judgeSubmission(
  p: { language: Language; source: string; cases: JudgeCase[]; timeLimitMs: number; memoryLimitMb: number },
  cfg: JudgeConfig,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<{ results: CaseResult[]; compileOutput?: string }> {
  if (!cfg.baseUrl) {
    return { results: [{ index: 0, verdict: "judge_unavailable", weight: 1 }] };
  }
  const results: CaseResult[] = [];
  let compileOutput: string | undefined;
  for (let i = 0; i < p.cases.length; i++) {
    const c = p.cases[i]!;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30_000);
    try {
      const res = await fetchImpl(`${cfg.baseUrl}/submissions?base64_encoded=true&wait=true`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(cfg.token ? { "X-Auth-Token": cfg.token } : {}) },
        body: JSON.stringify({
          language_id: LANGUAGES[p.language].judge0Id,
          source_code: b64(p.source),
          stdin: b64(c.input),
          cpu_time_limit: p.timeLimitMs / 1000,
          memory_limit: p.memoryLimitMb * 1024,
        }),
        signal: ctl.signal,
      });
      if (!res.ok) { results.push({ index: i, verdict: "judge_unavailable", weight: c.weight }); break; }
      const j = (await res.json()) as { status?: { id?: number }; stdout?: string; compile_output?: string; time?: string; memory?: number };
      let verdict = mapJudge0Status(Number(j.status?.id ?? 13));
      if (verdict === "accepted" && !outputsMatch(unb64(j.stdout), c.expectedOutput)) verdict = "wrong_answer";
      if (verdict === "compile_error") compileOutput = unb64(j.compile_output).slice(0, 2000);
      results.push({ index: i, verdict, weight: c.weight, timeMs: j.time ? Math.round(Number(j.time) * 1000) : undefined, memoryKb: j.memory });
      if (verdict === "compile_error") break; // same source: no point running the rest
    } catch {
      results.push({ index: i, verdict: "judge_unavailable", weight: c.weight });
      break;
    } finally {
      clearTimeout(timer);
    }
  }
  return { results, compileOutput };
}
