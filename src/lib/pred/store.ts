import type {
  BallEvent,
  ContestRecord,
  EngineControls,
  SettlementRecord,
  ContestStatus,
  ContestTemplate,
  EntryRecord,
  MatchFacts,
  MatchRef,
  PlannedQuestion,
  QuestionRecord,
  Resolution,
  RewardRules,
  ScoringRules,
  TriggerKind,
} from "./types";
import type { AnswerScore } from "./scoring";

export interface NewContest {
  generationKey: string;
  templateId: string | null;
  categoryId: string | null;
  matchId: string | null;
  sport: string;
  trigger: TriggerKind;
  title: string;
  status: Extract<ContestStatus, "draft" | "scheduled">;
  opensAt: string;
  locksAt: string;
  participantLimit: number | null;
  entryFee: number;
  minParticipants: number;
  prizeSplit: number[];
  isPrivate?: boolean;
  /** Private contests only: the code players redeem to get in (stored apart from the contest). */
  inviteCode?: string | null;
  allowEdit: boolean;
  scoring: ScoringRules;
  questions: PlannedQuestion[];
}

export interface Notice {
  /** null => broadcast row shown to every user (no per-user fan-out). */
  userId: string | null;
  kind: "match" | "contest" | "deadline" | "result" | "reward" | "rank" | "correction";
  title: string;
  body: string;
  link?: string;
  /** Unique: the same notice can never be created twice (job retries). */
  dedupeKey: string;
}

export interface CreditInput {
  userId: string;
  amount: number; // may be negative for a logged correction
  kind: "participation" | "answers" | "rank_bonus" | "contest_reward" | "adjustment" | "prize" | "refund" | "entry_fee" | "welcome_bonus" | "daily_bonus";
  refKey: string; // unique: the same credit can never apply twice
  contestId?: string;
}

export type ResolveOutcome = "applied" | "unchanged" | "changed";

/**
 * Persistence boundary of the engine. The Supabase implementation relies on
 * database unique constraints for idempotency; the in-memory implementation
 * enforces the same rules so the engine is testable without a database.
 */
export interface PredStore {
  // data from the sports-data layer
  listActiveMatches(): Promise<MatchRef[]>;
  getFacts(matchId: string): Promise<MatchFacts | null>;
  listEvents(matchId: string): Promise<BallEvent[]>;

  // configuration
  listTemplates(): Promise<ContestTemplate[]>;
  getRewardRules(): Promise<RewardRules>;
  /** Operator switches: pauses, disabled sports / competitions, excluded matches. */
  getControls(): Promise<EngineControls>;

  // contests
  insertContest(c: NewContest): Promise<{ contest: ContestRecord; created: boolean }>;
  getContest(contestId: string): Promise<ContestRecord | null>;
  /** Which of these generation keys already exist (any status). One query instead of one insert per contest. */
  existingContestKeys(keys: string[]): Promise<Set<string>>;
  countEntries(contestId: string): Promise<number>;
  markRefunded(contestId: string): Promise<void>;
  listContests(statuses: ContestStatus[], opts?: { updatedAfterMs?: number }): Promise<ContestRecord[]>;
  /** Atomic compare-and-set. Returns false if the contest was not in a `from` state. */
  transition(contestId: string, from: ContestStatus[], to: ContestStatus, reason?: string): Promise<boolean>;
  listQuestions(contestId: string): Promise<QuestionRecord[]>;
  staticKey(questionId: string): Promise<string | null>;
  /** Writes a resolution. If it differs from an existing one, the change is logged as a correction. */
  setResolution(
    questionId: string,
    res: Exclude<Resolution, { status: "pending" }>,
    actor: string,
    reason: string,
  ): Promise<ResolveOutcome>;
  bumpCorrectionVersion(contestId: string): Promise<number>;

  // entries and scoring
  listEntries(contestId: string): Promise<EntryRecord[]>;
  saveScores(entryId: string, scores: AnswerScore[], totals: { points: number; correct: number }): Promise<void>;

  // virtual-points ledger (idempotent by refKey)
  ledgerTotal(userId: string, refPrefix: string): Promise<number>;
  creditedSince(userId: string, sinceMs: number): Promise<number>;
  credit(input: CreditInput): Promise<boolean>;
  walletBalance(userId: string): Promise<number>;
  /** The platform's own virtual-points bucket (never a player). Idempotent by refKey. */
  platformCredit(input: { contestId: string; amount: number; kind: string; refKey: string }): Promise<boolean>;
  /** Virtual points the platform bucket already holds from this contest (for correction deltas). */
  platformHeld(contestId: string): Promise<number>;
  saveSettlement(s: SettlementRecord): Promise<void>;

  // notifications (idempotent by dedupeKey)
  notify(n: Notice): Promise<boolean>;

  // audit
  audit(action: string, actor: string, subject: string, detail: Record<string, unknown>): Promise<void>;
}
