// Sports prediction engine: shared domain types.
// Virtual points only (non-redeemable, never bought). Nothing in this module moves real money.

export type ContestStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "locked"
  | "settling"
  | "completed"
  | "cancelled"
  | "live" // locked, and the match is in play (spec: LIVE)
  | "void"; // ran but could not be settled (e.g. abandoned): entry fees are refunded

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
  /** Competition / series name when the provider supplies one. */
  series?: string | null;
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

export type ExtraType = "wide" | "noball" | "bye" | "legbye";

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
  /** Why the delivery carried extras, when the provider says. Unknown stays null (never guessed). */
  extraType?: ExtraType | null;
  revision: number; // bumped when the provider corrects an earlier record
}

export interface Bucketed {
  /** Ascending upper-bound thresholds, e.g. [140,170,200] => <140, 140-169, 170-199, 200+ */
  thresholds: number[];
}

export type QuestionRule =
  | { kind: "ball_outcome"; innings: number; over: number; ball: number; /** four options: 4 and 6 count as one "boundary" */ grouped?: boolean }
  /**
   * Primary outcome of one delivery slot of an over.
   *  mode "legal": slot = the Nth LEGAL delivery (wides / no-balls never advance the number)
   *  mode "event": slot = the Nth delivery of any kind, in the order bowled
   * Precedence when several things happen on one delivery: wicket > wide > no-ball > six > four > 3 > 2 > 1 > dot > other.
   */
  | { kind: "delivery_outcome"; innings: number; over: number; slot: number; mode: "legal" | "event" }
  | ({ kind: "over_runs"; innings: number; over: number } & Bucketed)
  | ({ kind: "innings_total"; innings: number } & Bucketed)
  /** Wickets lost in an innings (from the verified scorecard summary; no ball-by-ball data needed). */
  | ({ kind: "innings_wickets"; innings: number } & Bucketed)
  /** Combined runs of both innings once the match is complete. */
  | ({ kind: "match_total" } & Bucketed)
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
  generator: "match_winner" | "over_by_over" | "over_markets" | "innings_balls" | "innings_total" | "innings_wickets" | "match_total" | "score_pack" | "static";
  /** over_markets: "legal" (default) = Nth legal delivery, "event" = Nth delivery of any kind. */
  marketMode?: "legal" | "event";
  /** over_markets: which outcome options are offered (ids from DELIVERY_OPTIONS). Omit for all valid ones. */
  optionIds?: string[];
  /** over_markets: renamed option labels, keyed by option id. */
  optionLabels?: Record<string, string>;
  /** over_markets: which innings to cover (default [1, 2]). */
  inningsList?: number[];
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
  /** Virtual points charged to join (0 = free practice contest). */
  entryFee: number;
  /** Contest is cancelled and refunded at lock time if fewer people joined (0 = no minimum). */
  minParticipants: number;
  /** Percent of the entry pool paid per rank (rank 1 first). The remainder goes to the platform bucket. */
  prizeSplit: number[];
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
  entryFee: number;
  minParticipants: number;
  prizeSplit: number[];
  isPrivate: boolean;
  allowEdit: boolean;
  scoring: ScoringRules;
  correctionVersion: number;
  /** Set once every entry fee of a cancelled / voided contest has been returned. */
  refundedAt?: string | null;
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
  /** Virtual points this entry paid to join (refunded if the contest is cancelled or voided). */
  feePaid: number;
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

/** Spec defaults for ball-by-ball markets: +2 correct, -1 wrong, 0 when unanswered or void. */
export const BALL_MARKET_SCORING: ScoringRules = { pointsPerCorrect: 2, negativePerWrong: 1 };
export const DEFAULT_ENTRY_FEE = 13;
export const DEFAULT_PRIZE_SPLIT: number[] = [70];

/** Operator switches read by the scheduler. Anything not listed here is allowed. */
export type AbandonPolicy = "settle_verified" | "refund_all";

export interface EngineControls {
  pauseGeneration: boolean;
  pausePublication: boolean;
  pauseSettlement: boolean;
  /** Match abandoned / cancelled after contests locked: settle what was verified, or void and refund everything. */
  abandonPolicy: AbandonPolicy;
  disabledSports: string[];
  disabledSeries: string[];
  excludedMatchIds: string[];
}

export const NO_CONTROLS: EngineControls = {
  pauseGeneration: false, pausePublication: false, pauseSettlement: false, abandonPolicy: "settle_verified",
  disabledSports: [], disabledSeries: [], excludedMatchIds: [],
};

/** Auditable result of paying out one contest from its virtual-point pool. */
export interface SettlementRecord {
  contestId: string;
  version: number;
  participants: number;
  pool: number;
  prizeTotal: number;
  platformShare: number;
  payouts: Array<{ userId: string; rank: number; amount: number }>;
}

/** Spec defaults for pre-match markets: generate and open 3 hours before the start, lock 5 minutes before it. */
export const BALL_MARKET_TIMING: TemplateTiming = {
  trigger: "pre_match",
  createBeforeMin: 180,
  opensBeforeMin: 180,
  locksBeforeMin: 5,
  lockAfterMin: 5,
  catchUp: "shorten",
  minOpenMin: 5,
};

export const DEFAULT_TIMING: TemplateTiming = {
  trigger: "pre_match",
  createBeforeMin: 60,
  opensBeforeMin: 30,
  locksBeforeMin: 1,
  lockAfterMin: 5,
  catchUp: "shorten",
  minOpenMin: 5,
};
