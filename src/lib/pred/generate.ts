import type {
  ContestTemplate,
  MatchRef,
  PlannedQuestion,
  PlanSpec,
  QuestionOption,
  QuestionRule,
} from "./types";
import type { Milestone } from "./timing";
import { buildOptions, defaultOptionIds, validateOptionIds, type MarketMode } from "./delivery";

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

/** Four simple options for every delivery (4 and 6 are one "boundary" option). */
export const FOUR_BALL_OPTIONS: QuestionOption[] = [
  { id: "dot", label: "Dot ball (0)" },
  { id: "run", label: "1–3 runs" },
  { id: "boundary", label: "Four or Six" },
  { id: "wicket", label: "Wicket" },
];

/** Hard cap on questions per contest (a full 50-over innings is 300 deliveries). */
export const MAX_QUESTIONS = 300;

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
  if (qs.length < 1 || qs.length > MAX_QUESTIONS) return `A contest needs between 1 and ${MAX_QUESTIONS} questions.`;
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

export interface ExpandedContest {
  /** Appended to the generation key so every contest of a template/match pair has a stable, unique identity. */
  keySuffix: string;
  title: string;
  questions: PlannedQuestion[];
}
export type ExpandResult = { ok: true; contests: ExpandedContest[] } | { ok: false; reason: string };

/** Validates the delivery-market part of a plan. Returns a message, or null when it is usable. */
export function validateDeliveryPlan(plan: PlanSpec): string | null {
  if (plan.generator !== "over_markets") return null;
  const mode: MarketMode = plan.marketMode ?? "legal";
  const ids = plan.optionIds ?? defaultOptionIds(mode);
  const labelErr = validateOptionIds(ids, mode, plan.optionLabels ?? {});
  if (labelErr) return labelErr;
  if (plan.inningsList && (plan.inningsList.length < 1 || plan.inningsList.some((n) => !Number.isInteger(n) || n < 1 || n > 4))) return "Innings must be 1–4.";
  return null;
}

/**
 * One contest per over (per innings) with a question for every delivery slot of that over.
 * Pre-match: every over of every listed innings at once. In-match triggers: just the overs that are still in the future.
 */
function overMarketContests(match: MatchRef, tpl: ContestTemplate, milestone?: Milestone): ExpandResult {
  const plan = tpl.plan;
  const maxO = maxOvers(normalizeFormat(match.format));
  if (maxO === null) return { ok: false, reason: "format_not_supported" };
  const invalid = validateDeliveryPlan(plan);
  if (invalid) return { ok: false, reason: invalid };
  const mode: MarketMode = plan.marketMode ?? "legal";
  const options = buildOptions(plan.optionIds ?? defaultOptionIds(mode), plan.optionLabels ?? {});
  const slots = Math.min(6, Math.max(1, plan.balls ?? 6));
  const overLimit = Math.min(maxO, Math.max(1, plan.overs ?? maxO));
  const points = plan.points ?? tpl.scoring.pointsPerCorrect;
  const base = `${match.teamA} vs ${match.teamB}`;

  const targets: Array<{ innings: number; over: number }> = [];
  const trigger = tpl.timing.trigger;
  if (trigger === "pre_match") {
    for (const innings of plan.inningsList ?? [1, 2]) for (let over = 1; over <= overLimit; over++) targets.push({ innings, over });
  } else if (trigger === "after_over") {
    const innings = milestone?.innings ?? tpl.timing.innings ?? 1;
    const over = (milestone?.over ?? 0) + 1;
    if (over > overLimit) return { ok: false, reason: "over_out_of_range" };
    targets.push({ innings, over });
  } else if (trigger === "innings_break") {
    const innings = (milestone?.innings ?? tpl.timing.innings ?? 1) + 1;
    for (let over = 1; over <= overLimit; over++) targets.push({ innings, over });
  } else {
    return { ok: false, reason: "trigger_not_supported" };
  }

  const noun = mode === "legal" ? "Ball" : "Delivery";
  const contests: ExpandedContest[] = [];
  for (const t of targets) {
    const questions: PlannedQuestion[] = [];
    for (let slot = 1; slot <= slots; slot++) {
      questions.push({
        position: slot,
        prompt: `Innings ${t.innings} · Over ${t.over} · ${noun} ${slot}: what happens?`,
        options,
        rule: { kind: "delivery_outcome", innings: t.innings, over: t.over, slot, mode },
        points,
      });
    }
    const err = validateQuestions(questions);
    if (err) return { ok: false, reason: err };
    contests.push({ keySuffix: `i${t.innings}o${t.over}`, title: `${base} · Innings ${t.innings} · Over ${t.over}`, questions });
  }
  return { ok: true, contests };
}

/** All contests a template produces for a match (one for most generators, many for over_markets). */
export function expandTemplate(match: MatchRef, tpl: ContestTemplate, milestone?: Milestone): ExpandResult {
  if (tpl.plan.generator === "over_markets") return overMarketContests(match, tpl, milestone);
  const one = generateForTemplate(match, tpl, milestone);
  return one.ok ? { ok: true, contests: [{ keySuffix: "", title: one.title, questions: one.questions }] } : one;
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
    case "over_markets": {
      // Single-contest view (used to dry-run a template): the first contest of the set.
      const all = overMarketContests(match, tpl, milestone);
      return all.ok ? { ok: true, title: all.contests[0].title, questions: all.contests[0].questions } : all;
    }

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

    case "innings_balls": {
      const fullInnings = maxOvers(format);
      if (fullInnings === null) return { ok: false, reason: "format_not_supported" };
      const innings = plan.innings ?? 1;
      const overs = Math.min(fullInnings, Math.max(1, plan.overs ?? fullInnings));
      const qs: PlannedQuestion[] = [];
      for (let over = 1; over <= overs; over++) {
        for (let ball = 1; ball <= 6; ball++) {
          qs.push({
            position: qs.length + 1,
            prompt: `Innings ${innings} · Over ${over} · Ball ${ball}: what happens?`,
            options: FOUR_BALL_OPTIONS,
            rule: { kind: "ball_outcome", innings, over, ball, grouped: true },
            points,
          });
        }
      }
      return finish(`${base} · Every ball, innings ${innings}`, qs);
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
