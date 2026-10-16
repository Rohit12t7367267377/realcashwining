import type { BallEvent, MatchFacts, MatchRef, TemplateTiming } from "./types";

const MIN = 60_000;
/** Scheduler jitter we tolerate before treating a contest as "late". */
const GRACE_MS = 2 * MIN;

export type WindowPlan =
  | { create: true; opensAt: string; locksAt: string; caughtUp: boolean }
  | {
      create: false;
      reason: "too_early" | "match_started" | "late_discovery" | "expired" | "invalid_timing";
    };

export function validateTiming(t: TemplateTiming): string | null {
  const ints = [t.createBeforeMin, t.opensBeforeMin, t.locksBeforeMin, t.lockAfterMin, t.minOpenMin];
  if (ints.some((n) => !Number.isFinite(n) || n < 0 || n > 60 * 24 * 7)) return "Timing values must be 0..10080 minutes.";
  if (t.trigger === "pre_match") {
    if (!(t.createBeforeMin >= t.opensBeforeMin)) return "Creation must happen at or before registration opens.";
    if (!(t.opensBeforeMin > t.locksBeforeMin)) return "Registration must open before questions lock.";
  } else if (t.lockAfterMin < Math.max(1, t.minOpenMin)) {
    return "Lock delay must be at least the minimum open window.";
  }
  return null;
}

/**
 * Pre-match contests: decide whether to create one right now and with which
 * windows. Never returns an already-expired window.
 */
export function planPreMatchWindow(timing: TemplateTiming, startsAtIso: string | null, nowMs: number): WindowPlan {
  if (validateTiming(timing)) return { create: false, reason: "invalid_timing" };
  const start = startsAtIso ? Date.parse(startsAtIso) : NaN;
  if (!Number.isFinite(start)) return { create: false, reason: "invalid_timing" };
  if (nowMs >= start) return { create: false, reason: "match_started" };

  const locksAt = start - timing.locksBeforeMin * MIN;
  if (nowMs >= locksAt) return { create: false, reason: "expired" };
  if (nowMs < start - timing.createBeforeMin * MIN) return { create: false, reason: "too_early" };

  const plannedOpen = start - timing.opensBeforeMin * MIN;
  const late = nowMs > plannedOpen + GRACE_MS;
  if (!late) return { create: true, opensAt: new Date(plannedOpen).toISOString(), locksAt: new Date(locksAt).toISOString(), caughtUp: false };

  if (timing.catchUp === "skip") return { create: false, reason: "late_discovery" };
  if (locksAt - nowMs < timing.minOpenMin * MIN) return { create: false, reason: "expired" };
  return { create: true, opensAt: new Date(nowMs).toISOString(), locksAt: new Date(locksAt).toISOString(), caughtUp: true };
}

/** In-match milestone contests open immediately and lock after a short window. */
export function planMilestoneWindow(timing: TemplateTiming, nowMs: number): WindowPlan {
  if (validateTiming(timing)) return { create: false, reason: "invalid_timing" };
  return {
    create: true,
    opensAt: new Date(nowMs).toISOString(),
    locksAt: new Date(nowMs + timing.lockAfterMin * MIN).toISOString(),
    caughtUp: false,
  };
}

export interface Milestone {
  /** Stable suffix for the generation key. */
  key: string;
  innings?: number;
  over?: number;
}

/** Number of legal deliveries recorded for an over. */
export function legalCount(events: BallEvent[], innings: number, over: number) {
  return events.filter((e) => e.innings === innings && e.over === over && e.legal).length;
}

/**
 * Has the milestone this template waits for happened, and is it still early
 * enough that the questions are about the future (not already-bowled balls)?
 */
export function detectMilestone(
  timing: TemplateTiming,
  match: MatchRef,
  facts: MatchFacts | null,
  events: BallEvent[],
): Milestone | null {
  switch (timing.trigger) {
    case "pre_match":
      return match.state === "upcoming" ? { key: "pre" } : null;
    case "match_completed":
      return facts?.state === "completed" || match.state === "completed" ? { key: "final" } : null;
    case "innings_break": {
      if (!facts || facts.state !== "live") return null;
      const n = timing.innings ?? 1;
      const done = facts.innings.find((i) => i.no === n && i.complete);
      const nextStarted = facts.innings.some((i) => i.no === n + 1 && (i.overs > 0 || i.runs > 0));
      return done && !nextStarted ? { key: `inn${n}`, innings: n } : null;
    }
    case "after_over": {
      if (!facts || facts.state !== "live") return null;
      const innings = timing.innings ?? 1;
      const over = timing.afterOver ?? 1;
      const finished = legalCount(events, innings, over) >= 6;
      const nextOverStarted = events.some((e) => e.innings === innings && e.over === over + 1);
      return finished && !nextOverStarted ? { key: `inn${innings}.ov${over}`, innings, over } : null;
    }
  }
}
