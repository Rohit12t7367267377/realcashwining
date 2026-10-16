import { bucketIndex } from "./generate";
import type { BallEvent, BallOutcome, MatchFacts, QuestionRule, Resolution } from "./types";

/**
 * Settlement rules (documented so players and admins see the same thing):
 *  - A "delivery" means a LEGAL delivery. Wides and no-balls are not counted.
 *  - Wicket on that delivery (any dismissal incl. run-out) => "wicket".
 *  - Otherwise by runs off the bat: 0 => dot, 1-3 or 5 => run, 4 => four, 6 => six.
 *  - Byes / leg-byes are not bat runs, so they classify as dot.
 *  - Over runs include everything charged in that over (bat runs + all extras).
 */
export function classifyBall(e: BallEvent): BallOutcome {
  if (e.wicket) return "wicket";
  if (e.runsBat === 4) return "four";
  if (e.runsBat >= 6) return "six";
  if (e.runsBat > 0) return "run";
  return "dot";
}

export interface ResolveCtx {
  facts: MatchFacts | null;
  events: BallEvent[];
  /** For static questions: the answer fixed at creation. */
  staticCorrect?: string | null;
  /** Whether the contest's match has the Draw option (Test cricket). */
  hasDrawOption?: boolean;
}

function overEvents(events: BallEvent[], innings: number, over: number) {
  return events.filter((e) => e.innings === innings && e.over === over).sort((a, b) => a.seq - b.seq);
}

/** True when seq values run 1..n with no holes (otherwise data is incomplete). */
function contiguous(list: BallEvent[]) {
  return list.every((e, i) => e.seq === i + 1);
}

function inningsDone(facts: MatchFacts | null, innings: number) {
  if (!facts) return false;
  if (facts.state === "completed") return true;
  return facts.innings.some((i) => i.no === innings && i.complete);
}

const DEAD = new Set(["cancelled", "abandoned"]);

function resolveRule(rule: QuestionRule, ctx: ResolveCtx): Resolution {
  const { facts, events } = ctx;
  switch (rule.kind) {
    case "static":
      return ctx.staticCorrect ? { status: "resolved", optionId: ctx.staticCorrect } : { status: "pending" };

    case "manual":
      return { status: "pending" };

    case "match_winner": {
      if (!facts || facts.winner === null) return { status: "pending" };
      if (facts.winner === "A") return { status: "resolved", optionId: "a" };
      if (facts.winner === "B") return { status: "resolved", optionId: "b" };
      return ctx.hasDrawOption ? { status: "resolved", optionId: "draw" } : { status: "void", reason: "tie_no_option" };
    }

    case "innings_total": {
      const inn = facts?.innings.find((i) => i.no === rule.innings);
      if (!inn || !inningsDone(facts, rule.innings)) return { status: "pending" };
      return { status: "resolved", optionId: `b${bucketIndex(inn.runs, rule.thresholds)}` };
    }

    case "over_runs": {
      const list = overEvents(events, rule.innings, rule.over);
      if (!list.length || !contiguous(list)) return { status: "pending" };
      const complete = list.filter((e) => e.legal).length >= 6 || inningsDone(facts, rule.innings);
      if (!complete) return { status: "pending" };
      const runs = list.reduce((s, e) => s + e.runsBat + e.extras, 0);
      return { status: "resolved", optionId: `b${bucketIndex(runs, rule.thresholds)}` };
    }

    case "ball_outcome": {
      const list = overEvents(events, rule.innings, rule.over);
      const legal = list.filter((e) => e.legal);
      if (legal.length >= rule.ball) {
        const nth = legal[rule.ball - 1];
        const prefix = list.filter((e) => e.seq <= nth.seq);
        if (!contiguous(prefix)) return { status: "pending" }; // a record before it is missing
        return { status: "resolved", optionId: classifyBall(nth) };
      }
      return inningsDone(facts, rule.innings) ? { status: "void", reason: "delivery_not_bowled" } : { status: "pending" };
    }
  }
}

/** Resolves one question from verified data. Never guesses: unknown stays pending. */
export function resolveQuestion(rule: QuestionRule, ctx: ResolveCtx): Resolution {
  const r = resolveRule(rule, ctx);
  if (r.status === "pending" && ctx.facts && DEAD.has(ctx.facts.state)) return { status: "void", reason: "match_no_result" };
  return r;
}
