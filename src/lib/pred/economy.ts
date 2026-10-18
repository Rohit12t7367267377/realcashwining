// Virtual-points economy for entry-fee contests. Pure, integer-only, deterministic.
//
// Rules (shown to players and admins alike):
//  - Every join pays `entryFee` virtual points, taken atomically from the player's virtual wallet.
//  - The POOL is the sum of the entry fees actually paid. Nothing is minted: the prizes are funded by the entries.
//  - Rank r receives floor(pool * prizeSplit[r-1] / 100). Whatever is not paid out (the unallocated percentage
//    and every rounding remainder) goes to the platform's virtual-points bucket, so pool = prizes + platform, always.
//  - If fewer than `minParticipants` joined by the lock time, or the contest is cancelled / voided, every fee is refunded.
//  - Virtual points have no cash value: they cannot be bought, sold, transferred or withdrawn.
import { DEFAULT_PRIZE_SPLIT } from "./types";

export const MAX_PRIZE_RANKS = 10;

/** Clean percentage list; falls back to the default (winner 70%) when the input is unusable. */
export function normalizePrizeSplit(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PRIZE_RANKS) return [...DEFAULT_PRIZE_SPLIT];
  const out = raw.map((n) => (typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 100 ? n : NaN));
  if (out.some(Number.isNaN)) return [...DEFAULT_PRIZE_SPLIT];
  return out.reduce((a, b) => a + b, 0) <= 100 ? out : [...DEFAULT_PRIZE_SPLIT];
}

export function validatePrizeSplit(raw: number[]): string | null {
  if (raw.length < 1 || raw.length > MAX_PRIZE_RANKS) return `Prize split needs 1–${MAX_PRIZE_RANKS} ranks.`;
  if (raw.some((n) => !Number.isInteger(n) || n < 0 || n > 100)) return "Each prize percentage must be a whole number from 0 to 100.";
  if (raw.reduce((a, b) => a + b, 0) > 100) return "Prize percentages cannot add up to more than 100.";
  return null;
}

export interface Payout { userId: string; rank: number; amount: number }
export interface PoolPlan {
  participants: number;
  pool: number;
  payouts: Payout[]; // only ranks that actually receive something
  prizeTotal: number;
  platformShare: number;
}

/**
 * Splits the pool across the final ranking. `ranked` must already be in deterministic rank order
 * (see rankEntries), so every rank is unique and the result is reproducible.
 */
export function planPool(
  ranked: Array<{ userId: string; rank: number; feePaid: number }>,
  prizeSplit: number[],
  /** The pool when it is not simply the sum of `ranked` (e.g. entrants who answered nothing are not ranked but still paid in). */
  poolOverride?: number,
): PoolPlan {
  const pool = poolOverride ?? ranked.reduce((s, r) => s + Math.max(0, r.feePaid), 0);
  const payouts: Payout[] = [];
  for (const r of ranked) {
    const pct = prizeSplit[r.rank - 1] ?? 0;
    const amount = Math.floor((pool * pct) / 100);
    if (amount > 0) payouts.push({ userId: r.userId, rank: r.rank, amount });
  }
  const prizeTotal = payouts.reduce((s, p) => s + p.amount, 0);
  return { participants: ranked.length, pool, payouts, prizeTotal, platformShare: pool - prizeTotal };
}

export const feeRefKey = (contestId: string, userId: string) => `fee:${contestId}:${userId}`;
export const refundRefKey = (contestId: string, userId: string) => `refund:${contestId}:${userId}`;
export const prizeRefPrefix = (contestId: string, userId: string) => `prize:${contestId}:${userId}:`;
export const prizeRefKey = (contestId: string, userId: string, version: number, held: number) =>
  `prize:${contestId}:${userId}:v${version}:from${held}`;
export const platformRefKey = (contestId: string) => `platform:${contestId}`;
