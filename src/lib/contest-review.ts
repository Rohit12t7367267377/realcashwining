/**
 * Anti-cheat REVIEW flags for contest attempts. These are advisory signals for an administrator to review;
 * nothing here disqualifies anyone or changes a score, rank or prize automatically.
 */
export type ReviewAttempt = {
  id: string; userId: string; startedAt: string; submittedAt: string | null; violations: number;
  fingerprint: string | null; ip: string | null; answers: unknown;
};
export type ReviewFlag = { attemptId: string; userId: string; code: "tab_switching" | "too_fast" | "shared_device" | "shared_ip" | "identical_answers"; detail: string };

const cleanAnswers = (a: unknown): (number | null)[] | null => {
  if (!Array.isArray(a)) return null;
  return a.filter((x) => typeof x === "number" || x === null) as (number | null)[];
};

export function reviewFlags(attempts: ReviewAttempt[], opts: { numQuestions: number; minSecondsPerQuestion?: number; violationThreshold?: number }): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const minSpq = opts.minSecondsPerQuestion ?? 2;
  const vt = opts.violationThreshold ?? 3;
  const byFp = new Map<string, ReviewAttempt[]>();
  const byIp = new Map<string, ReviewAttempt[]>();
  const bySig = new Map<string, ReviewAttempt[]>();
  for (const a of attempts) {
    if (a.violations >= vt) flags.push({ attemptId: a.id, userId: a.userId, code: "tab_switching", detail: `${a.violations} tab/focus violations` });
    if (a.submittedAt && opts.numQuestions >= 5) {
      const secs = (new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime()) / 1000;
      if (secs >= 0 && secs < opts.numQuestions * minSpq) flags.push({ attemptId: a.id, userId: a.userId, code: "too_fast", detail: `finished in ${Math.round(secs)}s for ${opts.numQuestions} questions` });
    }
    if (a.fingerprint) byFp.set(a.fingerprint, [...(byFp.get(a.fingerprint) ?? []), a]);
    if (a.ip) byIp.set(a.ip, [...(byIp.get(a.ip) ?? []), a]);
    const ans = cleanAnswers(a.answers);
    // Only long, mostly-answered sheets: short quizzes match by chance.
    if (ans && ans.length >= 10 && ans.filter((x) => x !== null && x >= 0).length >= Math.ceil(ans.length * 0.8)) {
      const sig = ans.join(",");
      bySig.set(sig, [...(bySig.get(sig) ?? []), a]);
    }
  }
  const group = (m: Map<string, ReviewAttempt[]>, min: number, code: ReviewFlag["code"], label: string) => {
    for (const list of m.values()) {
      const users = new Set(list.map((x) => x.userId));
      if (users.size >= min) for (const a of list) flags.push({ attemptId: a.id, userId: a.userId, code, detail: `${label} with ${users.size - 1} other account(s)` });
    }
  };
  group(byFp, 2, "shared_device", "same device fingerprint");
  group(byIp, 3, "shared_ip", "same IP address");
  group(bySig, 2, "identical_answers", "identical answer sheet");
  return flags;
}
