import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { periodKeyFor } from "@/lib/period-key";

export type AutomationSettings = {
  auto_quiz_generation: boolean;
  auto_result: boolean;
  auto_leaderboard: boolean;
  auto_prize_distribution: boolean;
  /** Percentage split of the prize pool across ranks 1..n */
  prize_split: number[];
  /** Leaderboard prize amounts (cash) for ranks 1..n, per period */
  leaderboard_prizes: { week: number[]; month: number[]; year: number[] };
};

export const AUTOMATION_DEFAULTS: AutomationSettings = {
  auto_quiz_generation: false,
  auto_result: true,
  auto_leaderboard: true,
  auto_prize_distribution: false,
  prize_split: [50, 30, 20],
  leaderboard_prizes: { week: [100, 50, 25], month: [500, 250, 100], year: [2000, 1000, 500] },
};

const KEYS = Object.keys(AUTOMATION_DEFAULTS) as (keyof AutomationSettings)[];

function unwrap<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }
  return raw as T;
}

export async function readAutomationSettings(): Promise<AutomationSettings> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", KEYS as string[]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value]));
  const out = { ...AUTOMATION_DEFAULTS };
  for (const k of KEYS) {
    if (map.has(k)) {
      // @ts-expect-error indexed assignment across the union of value types
      out[k] = unwrap(map.get(k), AUTOMATION_DEFAULTS[k]);
    }
  }
  return out;
}

type AttemptRow = {
  id: string;
  user_id: string;
  score: number | null;
  violations: number;
  status: string;
  submitted_at: string | null;
  answers: unknown;
};

function correctCount(answers: unknown): number {
  if (answers && typeof answers === "object" && !Array.isArray(answers)) {
    const n = Number((answers as Record<string, unknown>)["_correct"]);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Tie-break order: higher score, then more correct answers, then earlier
 * submission, then fewer anti-cheat violations.
 */
export function rankAttempts(attempts: AttemptRow[]): AttemptRow[] {
  return [...attempts].sort((a, b) => {
    const s = Number(b.score ?? 0) - Number(a.score ?? 0);
    if (s !== 0) return s;
    const c = correctCount(b.answers) - correctCount(a.answers);
    if (c !== 0) return c;
    const ta = a.submitted_at ? Date.parse(a.submitted_at) : Number.MAX_SAFE_INTEGER;
    const tb = b.submitted_at ? Date.parse(b.submitted_at) : Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return (a.violations ?? 0) - (b.violations ?? 0);
  });
}

export function prizeForRank(
  rank: number,
  opts: { pool: number; first: number; split: number[] },
): number {
  if (rank === 1 && opts.first > 0) return opts.first;
  const pct = opts.split[rank - 1];
  if (!pct || opts.pool <= 0) return 0;
  return Math.round(((opts.pool * pct) / 100) * 100) / 100;
}

/**
 * Locks a contest, auto-scores every submission, ranks with tie-breaks,
 * credits wallet prizes and marks results as declared. Notifications are
 * derived from the wallet transaction + declared attempt rows, so users see
 * them in their notification centre automatically.
 */
export async function finalizeContest(contestId: string, settings?: AutomationSettings) {
  const cfg = settings ?? (await readAutomationSettings());

  const { data: contest, error: cErr } = await supabaseAdmin
    .from("contests")
    .select("id, title, prize_pool, first_prize, results_status")
    .eq("id", contestId)
    .single();
  if (cErr) throw new Error(cErr.message);
  if (contest.results_status === "declared") {
    return { contestId, skipped: "already declared" as const, ranked: 0 };
  }

  // 1. Lock: any in-progress submission that never got submitted is closed out.
  await supabaseAdmin
    .from("contest_attempts")
    .update({ status: "completed", submitted_at: new Date().toISOString() })
    .eq("contest_id", contestId)
    .eq("status", "in_progress");

  // 2. Evaluate answers against stored correct answers + admin point settings.
  const { error: sErr } = await supabaseAdmin.rpc("auto_score_contest", { _contest_id: contestId });
  if (sErr) throw new Error(sErr.message);

  // 3. Rank + award.
  const { data: attempts, error: aErr } = await supabaseAdmin
    .from("contest_attempts")
    .select("id, user_id, score, violations, status, submitted_at, answers")
    .eq("contest_id", contestId);
  if (aErr) throw new Error(aErr.message);

  const ranked = rankAttempts((attempts ?? []) as AttemptRow[]);
  const pool = Number(contest.prize_pool ?? 0);
  const first = Number(contest.first_prize ?? 0);
  const split = Array.isArray(cfg.prize_split) ? cfg.prize_split : AUTOMATION_DEFAULTS.prize_split;

  for (let i = 0; i < ranked.length; i++) {
    const rank = i + 1;
    const prize = cfg.auto_prize_distribution ? prizeForRank(rank, { pool, first, split }) : 0;
    const { error } = await supabaseAdmin.rpc("admin_declare_contest_result", {
      _contest_id: contestId,
      _attempt_id: ranked[i].id,
      _rank: rank,
      _prize: prize,
    });
    if (error) throw new Error(error.message);
  }

  // 4. Publish results.
  await supabaseAdmin.from("contests").update({ results_status: "declared" }).eq("id", contestId);

  return { contestId, ranked: ranked.length, skipped: null };
}

/** Finalises every contest whose end time has passed and is still pending. */
export async function runAutoResults() {
  const cfg = await readAutomationSettings();
  if (!cfg.auto_result) return { enabled: false, processed: [] as string[] };

  const { data: due } = await supabaseAdmin
    .from("contests")
    .select("id")
    .eq("results_status", "pending")
    .not("ends_at", "is", null)
    .lt("ends_at", new Date().toISOString())
    .limit(25);

  const processed: string[] = [];
  for (const c of due ?? []) {
    try {
      await finalizeContest(c.id, cfg);
      processed.push(c.id);
    } catch {
      // keep going; a single bad contest must not stall the batch
    }
  }
  return { enabled: true, processed };
}

/**
 * Awards period leaderboard prizes once per period key. Safe to call
 * repeatedly — existing awards for the same period/rank are skipped.
 */
export async function runAutoLeaderboardPrizes(period: "week" | "month" | "year") {
  const cfg = await readAutomationSettings();
  if (!cfg.auto_leaderboard || !cfg.auto_prize_distribution) {
    return { enabled: false, awarded: 0, periodKey: periodKeyFor(period) };
  }
  const periodKey = periodKeyFor(period);
  const amounts = cfg.leaderboard_prizes?.[period] ?? [];
  if (!amounts.length) return { enabled: true, awarded: 0, periodKey };

  const { data: existing } = await supabaseAdmin
    .from("prize_awards")
    .select("id")
    .eq("period", period)
    .eq("period_key", periodKey)
    .limit(1);
  if (existing?.length) return { enabled: true, awarded: 0, periodKey, skipped: "already awarded" };

  const rows = await periodLeaderboardRows(period, amounts.length);
  let awarded = 0;
  for (let i = 0; i < rows.length; i++) {
    const amount = Number(amounts[i] ?? 0);
    if (amount <= 0) continue;
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("wallet_balance")
      .eq("id", rows[i].userId)
      .single();
    if (!prof) continue;
    await supabaseAdmin
      .from("profiles")
      .update({ wallet_balance: Number(prof.wallet_balance) + amount })
      .eq("id", rows[i].userId);
    await supabaseAdmin.from("transactions").insert({
      user_id: rows[i].userId,
      type: "credit",
      amount,
      note: `${period} leaderboard prize · rank ${i + 1}`,
    });
    await supabaseAdmin.from("prize_awards").insert({
      user_id: rows[i].userId,
      period,
      period_key: periodKey,
      rank: i + 1,
      kind: "cash",
      amount,
      description: `Automatic ${period}ly leaderboard prize`,
      status: "awarded",
    });
    awarded++;
  }
  return { enabled: true, awarded, periodKey };
}

/** Aggregated period leaderboard built from declared contest results. */
export async function periodLeaderboardRows(period: "week" | "month" | "year", limit = 50) {
  const days = period === "week" ? 7 : period === "month" ? 30 : 365;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data: declared } = await supabaseAdmin
    .from("contests")
    .select("id")
    .eq("results_status", "declared");
  const ids = (declared ?? []).map((c) => c.id);
  if (!ids.length) return [];

  const { data: attempts } = await supabaseAdmin
    .from("contest_attempts")
    .select("user_id, score, prize_awarded, is_winner, submitted_at")
    .in("contest_id", ids)
    .gte("submitted_at", since)
    .not("submitted_at", "is", null);

  const agg = new Map<string, { userId: string; score: number; prize: number; played: number; wins: number }>();
  (attempts ?? []).forEach((a) => {
    const cur = agg.get(a.user_id) ?? { userId: a.user_id, score: 0, prize: 0, played: 0, wins: 0 };
    cur.score += Number(a.score ?? 0);
    cur.prize += Number(a.prize_awarded ?? 0);
    cur.played += 1;
    if (a.is_winner) cur.wins += 1;
    agg.set(a.user_id, cur);
  });

  return Array.from(agg.values())
    .sort((a, b) => b.score - a.score || b.prize - a.prize || b.wins - a.wins)
    .slice(0, limit);
}
