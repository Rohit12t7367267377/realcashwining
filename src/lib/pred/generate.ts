import type {
  ContestTemplate,
  MatchRef,
  PlannedQuestion,
  PlanSpec,
  QuestionOption,
  QuestionRule,
} from "./types";
import type { Milestone } from "./timing";

export type GenResult =
  | { ok: true; title: string; questions: PlannedQuestion[] }
  | { ok: false; reason: string };

export function normalizeFormat(raw: string): string {
  const s = raw.toLowerCase();
  if (/t10/.test(s)) return "t10";
  if (/t20|twenty/.test(s)) return "t20";
  if (/odi|one.?day|list.?a/.test(s)) return "odi";
  if (/test|first.?class/.test(s)) return "test";
  return s.trim() || "unknown";
}

/** Maximum overs per innings for limited-overs formats; null when not applicable. */
export function maxOvers(format: string): number | null {
  switch (normalizeFormat(format)) {
    case "t10": return 10;
    case "t20": return 20;
    case "odi": return 50;
    default: return null;
  }
}

const DEFAULT_THRESHOLDS: Record<string, number[]> = {
  t10: [80, 100, 120],
  t20: [140, 170, 200],
  odi: [220, 280, 330],
};

export function bucketOptions(thresholds: number[], unit = ""): QuestionOption[] {
  const t = [...thresholds];
  const opts: QuestionOption[] = [{ id: "b0", label: `Under ${t[0]}${unit}` }];
  for (let i = 0; i < t.length - 1; i++) opts.push({ id: `b${i + 1}`, label: `${t[i]}–${t[i + 1] - 1}${unit}` });
  opts.push({ id: `b${t.length}`, label: `${t[t.length - 1]} or more${unit}` });
  return opts;
}

export function bucketIndex(value: number, thresholds: number[]): number {
  let i = 0;
  while (i < thresholds.length && value >= thresholds[i]) i++;
  return i;
}

export const BALL_OPTIONS: QuestionOption[] = [
  { id: "dot", label: "Dot ball" },
  { id: "run", label: "Run(s), no boundary" },
  { id: "four", label: "Four" },
  { id: "six", label: "Six" },
  { id: "wicket", label: "Wicket" },
];

function validThresholds(t: unknown): t is number[] {
  return (
    Array.isArray(t) &&
    t.length >= 1 &&
    t.length <= 8 &&
    t.every((n, i) => Number.isInteger(n) && n > 0 && (i === 0 || n > t[i - 1]))
  );
}

/** Structural validation applied to every question set before it can exist. */
export function validateQuestions(qs: PlannedQuestion[]): string | null {
  if (qs.length < 1 || qs.length > 50) return "A contest needs between 1 and 50 questions.";
  const seen = new Set<number>();
  for (const q of qs) {
    if (!Number.isInteger(q.position) || q.position < 1 || seen.has(q.position)) return "Question positions must be unique, starting at 1.";
    seen.add(q.position);
    if (q.prompt.trim().length < 3 || q.prompt.length > 300) return `Question ${q.position}: prompt must be 3–300 characters.`;
    if (q.options.length < 2 || q.options.length > 8) return `Question ${q.position}: needs 2–8 options.`;
    const ids = new Set(q.options.map((o) => o.id));
    const labels = new Set(q.options.map((o) => o.label.trim().toLowerCase()));
    if (ids.size !== q.options.length || labels.size !== q.options.length) return `Question ${q.position}: options must be unique.`;
    if (q.options.some((o) => !o.id || !o.label.trim() || o.label.length > 120)) return `Question ${q.position}: option text is invalid.`;
    if (!Number.isInteger(q.points) || q.points < 1 || q.points > 1000) return `Question ${q.position}: points must be 1–1000.`;
    if (q.rule.kind === "static" && (!q.staticCorrect || !ids.has(q.staticCorrect))) return `Question ${q.position}: a correct answer is required.`;
  }
  return null;
}

function finish(title: string, questions: PlannedQuestion[]): GenResult {
  const err = validateQuestions(questions);
  return err ? { ok: false, reason: err } : { ok: true, title, questions };
}

/**
 * Turns a declarative plan into questions. Generators are building blocks; the
 * categories and templates that use them are data an admin controls.
 */
export function generateForTemplate(match: MatchRef, tpl: ContestTemplate, milestone?: Milestone): GenResult {
  const plan: PlanSpec = tpl.plan;
  const format = normalizeFormat(match.format);
  const base = `${match.teamA} vs ${match.teamB}`;
  const points = plan.points ?? tpl.scoring.pointsPerCorrect;
  const title = `${base} · ${tpl.name}`;

  switch (plan.generator) {
    case "match_winner": {
      const options: QuestionOption[] = [
        { id: "a", label: match.teamA },
        { id: "b", label: match.teamB },
      ];
      if (format === "test") options.push({ id: "draw", label: "Draw" });
      const rule: QuestionRule = { kind: "match_winner" };
      return finish(title, [{ position: 1, prompt: `Who will win ${base}?`, options, rule, points }]);
    }

    case "over_by_over": {
      const maxO = maxOvers(format);
      if (maxO === null) return { ok: false, reason: "format_not_supported" };
      const innings = milestone?.innings ?? plan.innings ?? 1;
      const over = milestone?.over !== undefined ? milestone.over + 1 : plan.over ?? 1;
      const balls = Math.min(6, Math.max(1, plan.balls ?? 6));
      if (over < 1 || over > maxO) return { ok: false, reason: "over_out_of_range" };
      const qs: PlannedQuestion[] = [];
      for (let b = 1; b <= balls; b++) {
        qs.push({
          position: b,
          prompt: `Innings ${innings}, over ${over}: what happens on legal delivery ${b}?`,
          options: BALL_OPTIONS,
          rule: { kind: "ball_outcome", innings, over, ball: b },
          points,
        });
      }
      return finish(`${base} · Over ${over} (innings ${innings})`, qs);
    }

    case "innings_total": {
      const innings = plan.innings ?? 1;
      const thresholds = plan.thresholds ?? DEFAULT_THRESHOLDS[format];
      if (!validThresholds(thresholds)) return { ok: false, reason: "thresholds_required" };
      return finish(title, [
        {
          position: 1,
          prompt: `Innings ${innings}: how many runs will be scored?`,
          options: bucketOptions(thresholds),
          rule: { kind: "innings_total", innings, thresholds },
          points,
        },
      ]);
    }

    case "static": {
      const items = plan.questions ?? [];
      const qs: PlannedQuestion[] = items.map((q, i) => {
        const options = q.options.map((label, j) => ({ id: `o${j + 1}`, label }));
        return {
          position: i + 1,
          prompt: q.prompt,
          options,
          rule: { kind: "static" } as QuestionRule,
          points,
          staticCorrect: options[q.correctIndex]?.id,
        };
      });
      return finish(title, qs);
    }
  }
}

export function generationKey(templateId: string, matchId: string, trigger: string, milestoneKey: string) {
  return `${templateId}:${matchId}:${trigger}:${milestoneKey}`;
}
