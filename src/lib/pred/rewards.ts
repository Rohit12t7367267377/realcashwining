import type { RewardRules } from "./types";
import type { RankedEntry } from "./scoring";

export interface DesiredReward {
  userId: string;
  participation: number;
  correct: number;
  rankBonus: number;
  total: number;
}

/**
 * What each participant SHOULD hold in total from one contest, given the final
 * verified ranking. The engine credits only the difference from what the
 * ledger already holds, so repeated runs and corrections never double-pay.
 */
export function desiredRewards(
  ranked: Array<RankedEntry & { answered: number }>,
  rules: RewardRules,
  contestCancelled = false,
): DesiredReward[] {
  if (contestCancelled) return ranked.map((r) => ({ userId: r.userId, participation: 0, correct: 0, rankBonus: 0, total: 0 }));
  return ranked.map((r) => {
    const participation = r.answered > 0 ? rules.participation : 0;
    const correct = Math.max(0, r.correct) * rules.perCorrect;
    const rankBonus = r.points > 0 ? rules.rankBonus[r.rank - 1] ?? 0 : 0;
    const total = Math.min(rules.maxPerContest, participation + correct + rankBonus);
    return { userId: r.userId, participation, correct, rankBonus, total };
  });
}

export const rewardRefKey = (contestId: string, userId: string, version: number) =>
  `contest:${contestId}:${userId}:v${version}`;

export const rewardRefPrefix = (contestId: string, userId: string) => `contest:${contestId}:${userId}:`;

/** Applies the per-day cap to a proposed credit. Debits (negative) are never capped. */
export function applyDailyCap(amount: number, creditedToday: number, dailyCap: number) {
  if (amount <= 0) return amount;
  return Math.max(0, Math.min(amount, dailyCap - creditedToday));
}
