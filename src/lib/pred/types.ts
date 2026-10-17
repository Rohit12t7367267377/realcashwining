// Free-to-play sports prediction engine: shared domain types.
// Virtual points only. Nothing in this module moves real money.

export type ContestStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "locked"
  | "settling"
  | "completed"
  | "cancelled";

export type MatchState =
  | "upcoming"
  | "live"
  | "completed"
  | "postponed"
  | "cancelled"
  | "abandoned"
  | "unknown";

export type TriggerKind = "pre_match" | "innings_break" | "after_over" | "match_completed";

export type BallOutcome = "dot" | "run" | "four" | "six" | "wicket";

export interface MatchRef {
  id: string;
  sport: string; // "cricket", "football", ...
  format: string; // "t20", "odi", "test", ...
  startsAt: string | null; // ISO
  state: MatchState;
  teamA: string;
  teamB: string;
  statusText: string;
}

export interface InningsFacts {
  no: number;
  team: string;
  runs: number;
  wickets: number;
  overs: number;
  complete: boolean;
}

/** Verified, provider-derived facts about a match. Never invented. */
export interface MatchFacts {
  matchId: string;
  state: MatchState;
  statusText: string;
  teamA: string;
  teamB: string;
  /** "A" | "B" | "tie" when officially decided, null while unknown. */
  winner: "A" | "B" | "tie" | null;
  innings: InningsFacts[];
  verifiedAt: string;
}

export interface BallEvent {
  eventKey: string; // stable provider identity (idempotency)
  matchId: string;
  innings: number;
  over: number; // 1-based
  seq: number; // 1-based position of the delivery in the over, wides included
  legal: boolean; // false for wides / no-balls
  runsBat: number;
  extras: number;
  wicket: boolean;
  revision: number; // bumped when the provider corrects an earlier record
}

export interface Bucketed {
  /** Ascending upper-bound thresholds, e.g. [140,170,200] => <140, 140-169, 170-199, 200+ */
  thresholds: number[];
}

export type QuestionRule =
  | { kind: "ball_outcome"; innings: number; over: number; ball: number; /** four options: 4 and 6 count as one "boundary" */ grouped?: boolean }
  | ({ kind: "over_runs"; innings: number; over: number } & Bucketed)
  | ({ kind: "innings_total"; innings: number } & Bucketed)
  | { kind: "match_winner" }
  | { kind: "static" } // trivia / custom: answer fixed at creation
  | { kind: "manual" }; // resolved by an administrator through the logged process

export interface QuestionOption {
  id: string;
  label: string;
}

export interface PlannedQuestion {
  position: number;
  prompt: string;
  options: QuestionOption[];
  rule: QuestionRule;
  points: number;
  /** Only for rule.kind === "static": the correct option id. Stored in the key table, never sent to players. */
  staticCorrect?: string;
}

export interface TemplateTiming {
  trigger: TriggerKind;
  /** pre_match: minutes before start to create / open / lock. */
  createBeforeMin: number;
  opensBeforeMin: number;
  locksBeforeMin: number;
  /** In-match triggers: minutes after the trigger to lock. */
  lockAfterMin: number;
  /** What to do when the match is discovered after the planned open time. */
  catchUp: "skip" | "shorten";
  /** Minimum open window for a catch-up contest to be worth publishing. */
  minOpenMin: number;
  /** For after_over triggers: which over completing triggers the contest (1-based). */
  afterOver?: number;
  /** For after_over / innings_break: which innings. */
  innings?: number;
}

export interface PlanSpec {
  generator: "match_winner" | "over_by_over" | "innings_balls" | "innings_total" | "static";
  /** innings_balls: how many overs to cover (defaults to the format's full innings, e.g. 20 for T20) */
  overs?: number;
  /** over_by_over */
  innings?: number;
  over?: number;
  balls?: number;
  /** innings_total / over_runs thresholds */
  thresholds?: number[];
  /** static */
  questions?: Array<{ prompt: string; options: string[]; correctIndex: number }>;
  points?: number;
}

export interface ScoringRules {
  pointsPerCorrect: number;
  /** Subtracted for a wrong answer. Default 0 (no negative marking). */
  negativePerWrong: number;
}

export interface ContestTemplate {
  id: string;
  categoryId: string | null;
  name: string;
  sport: string;
  formats: string[]; // empty => any
  plan: PlanSpec;
  timing: TemplateTiming;
  scoring: ScoringRules;
  participantLimit: number | null;
  autoGenerate: boolean;
  requireApproval: boolean;
  allowEdit: boolean;
  enabled: boolean;
}

export interface ContestRecord {
  id: string;
  generationKey: string;
  templateId: string | null;
  categoryId: string | null;
  matchId: string | null;
  sport: string;
  trigger: TriggerKind;
  title: string;
  status: ContestStatus;
  opensAt: string;
  locksAt: string;
  participantLimit: number | null;
  allowEdit: boolean;
  scoring: ScoringRules;
  correctionVersion: number;
}

export interface QuestionRecord extends PlannedQuestion {
  id: string;
  contestId: string;
  status: "open" | "resolved" | "void";
  resolvedOption: string | null;
  voidReason: string | null;
}

export interface EntryRecord {
  id: string;
  contestId: string;
  userId: string;
  submittedAt: string;
  answers: Record<string, string>; // questionId -> optionId
  points: number;
  correct: number;
  answered: number;
}

export type Resolution =
  | { status: "pending" }
  | { status: "resolved"; optionId: string }
  | { status: "void"; reason: string };

export interface RewardRules {
  participation: number; // per entry in a completed contest
  perCorrect: number; // per correct answer
  rankBonus: number[]; // rank 1..n
  maxPerContest: number; // hard cap per user per contest
  dailyCap: number; // hard cap per user per UTC day across contests
}

export const DEFAULT_REWARDS: RewardRules = {
  participation: 5,
  perCorrect: 2,
  rankBonus: [50, 30, 20],
  maxPerContest: 200,
  dailyCap: 1000,
};

export const DEFAULT_SCORING: ScoringRules = { pointsPerCorrect: 10, negativePerWrong: 0 };

export const DEFAULT_TIMING: TemplateTiming = {
  trigger: "pre_match",
  createBeforeMin: 60,
  opensBeforeMin: 30,
  locksBeforeMin: 1,
  lockAfterMin: 5,
  catchUp: "shorten",
  minOpenMin: 5,
};
