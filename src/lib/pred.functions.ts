// Player-facing server functions for free-to-play prediction contests.
// They run as the signed-in user (RLS applies); scoring/settlement is never
// done here, and the client can never write answers, scores, ranks or points.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const db = (ctx: { supabase: unknown }) => ctx.supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const PUBLIC_STATUSES = ["published", "locked", "settling", "completed"];

export const listPredContests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = db(context);
    const since = new Date(Date.now() - 3 * 24 * 3_600_000).toISOString();
    const { data: contests, error } = await sb
      .from("pred_contests")
      .select("id, title, status, sport, trigger, opens_at, locks_at, participant_limit, match_id, category_id, allow_edit")
      .in("status", PUBLIC_STATUSES)
      .gte("locks_at", since)
      .order("locks_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = (contests as any[]).map((c) => c.id);
    const matchIds = [...new Set((contests as any[]).map((c) => c.match_id).filter(Boolean))];
    const [mine, matches, counts] = await Promise.all([
      ids.length ? sb.from("pred_entries").select("contest_id, points, correct").in("contest_id", ids) : { data: [] },
      matchIds.length ? sb.from("cricket_matches").select("id, name, team_a, team_b, date_time, status").in("id", matchIds) : { data: [] },
      ids.length ? sb.from("pred_entries").select("contest_id").in("contest_id", ids).limit(50_000) : { data: [] },
    ]);
    const myMap = new Map<string, any>((mine.data ?? []).map((e: any) => [e.contest_id, e]));
    const matchMap = new Map<string, any>((matches.data ?? []).map((m: any) => [m.id, m]));
    const countMap = new Map<string, number>();
    for (const e of counts.data ?? []) countMap.set(e.contest_id, (countMap.get(e.contest_id) ?? 0) + 1);
    return (contests as any[]).map((c) => ({
      ...c,
      match: matchMap.get(c.match_id) ?? null,
      entered: myMap.has(c.id),
      my_points: myMap.get(c.id)?.points ?? null,
      participants: countMap.get(c.id) ?? 0,
    }));
  });

export const getPredContest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = db(context);
    const { data: contest, error } = await sb.from("pred_contests").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!contest) throw new Error("Contest not found");
    const { data: questions } = await sb
      .from("pred_questions")
      .select("id, position, prompt, options, points, status, resolved_option, void_reason")
      .eq("contest_id", data.id)
      .order("position");
    const { data: entry } = await sb.from("pred_entries").select("id, points, correct, submitted_at").eq("contest_id", data.id).maybeSingle();
    let answers: Record<string, string> = {};
    let scores: Record<string, { points: number; correct: boolean }> = {};
    if (entry) {
      const [a, s] = await Promise.all([
        sb.from("pred_answers").select("question_id, option_id").eq("entry_id", entry.id),
        sb.from("pred_scores").select("question_id, points, correct").eq("entry_id", entry.id),
      ]);
      answers = Object.fromEntries((a.data ?? []).map((r: any) => [r.question_id, r.option_id]));
      scores = Object.fromEntries((s.data ?? []).map((r: any) => [r.question_id, { points: r.points, correct: r.correct }]));
    }
    const { data: match } = contest.match_id
      ? await sb.from("cricket_matches").select("id, name, team_a, team_b, score_a, score_b, status, is_live, date_time, fetched_at").eq("id", contest.match_id).maybeSingle()
      : { data: null };
    const { count } = await sb.from("pred_entries").select("id", { count: "exact", head: true }).eq("contest_id", data.id);
    return { contest, questions: questions ?? [], entry: entry ?? null, answers, scores, match, participants: count ?? 0, serverNow: new Date().toISOString() };
  });

export const submitPredAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      contestId: z.string().uuid(),
      answers: z.record(z.string().uuid(), z.string().min(1).max(40)).refine((o) => Object.keys(o).length >= 1 && Object.keys(o).length <= 300, "Invalid answers"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // All rules (window, one entry, valid options, limits) are enforced inside the database function.
    const { data: entryId, error } = await db(context).rpc("pred_submit_answers", { _contest_id: data.contestId, _answers: data.answers });
    if (error) throw new Error(error.message);
    return { entryId: entryId as string };
  });

const periodSchema = z.enum(["daily", "weekly", "monthly", "all"]);
const scopeSchema = z.enum(["contest", "match", "sport", "category", "overall"]);

function periodRange(period: z.infer<typeof periodSchema>) {
  const now = new Date();
  const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));
  if (period === "daily") return { since: d(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) };
  if (period === "weekly") {
    const dow = (now.getUTCDay() + 6) % 7; // Monday start
    return { since: d(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow) };
  }
  if (period === "monthly") return { since: d(now.getUTCFullYear(), now.getUTCMonth(), 1) };
  return { since: null as Date | null };
}

export const getPredBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      scope: scopeSchema.default("overall"),
      scopeId: z.string().max(80).default(""),
      period: periodSchema.default("all"),
      friends: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = db(context);
    const { since } = periodRange(data.period);
    const args = { _scope: data.scope, _scope_id: data.scopeId, _since: since ? since.toISOString() : null, _until: null, _friends: data.friends };
    const [top, me] = await Promise.all([
      sb.rpc("pred_board", { ...args, _limit: 50, _only_user: null }),
      sb.rpc("pred_board", { ...args, _limit: 1, _only_user: context.userId }),
    ]);
    if (top.error) throw new Error(top.error.message);
    const rows = (top.data ?? []).map((r: any) => ({
      rank: Number(r.rank_no), userId: r.user_id, name: r.username, avatar: r.avatar_url,
      points: Number(r.points), correct: Number(r.correct), contests: Number(r.contests),
    }));
    const mine = (me.data ?? [])[0];
    return {
      rows,
      me: mine ? { rank: Number(mine.rank_no), points: Number(mine.points), correct: Number(mine.correct), contests: Number(mine.contests) } : null,
    };
  });

export const getPredWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = db(context);
    const [{ data: wallet }, { data: ledger }] = await Promise.all([
      sb.from("pred_wallets").select("balance").eq("user_id", context.userId).maybeSingle(),
      sb.from("pred_ledger").select("id, amount, kind, contest_id, created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    return { balance: Number(wallet?.balance ?? 0), ledger: ledger ?? [] };
  });

const NOTICE_KINDS = ["match", "contest", "deadline", "result", "reward", "rank", "correction"] as const;

export const listPredNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = db(context);
    const [{ data: prefs }, { data: rows }] = await Promise.all([
      sb.from("pred_notification_prefs").select("*").eq("user_id", context.userId).maybeSingle(),
      sb.from("pred_notifications").select("id, kind, title, body, link, created_at, user_id").order("created_at", { ascending: false }).limit(60),
    ]);
    const p = prefs ?? {};
    return {
      prefs: Object.fromEntries(NOTICE_KINDS.map((k) => [k, p[k] ?? true])) as Record<(typeof NOTICE_KINDS)[number], boolean>,
      items: (rows ?? []).filter((n: any) => p[n.kind] !== false),
    };
  });

export const savePredNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object(Object.fromEntries(NOTICE_KINDS.map((k) => [k, z.boolean()])) as Record<(typeof NOTICE_KINDS)[number], z.ZodBoolean>).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await db(context).from("pred_notification_prefs").upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
