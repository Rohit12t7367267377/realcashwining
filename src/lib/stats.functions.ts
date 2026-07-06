import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the signed-in user's contest stats: prize won, played, wins. */
export const getMyContestStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: attempts } = await supabase
      .from("contest_attempts")
      .select("id, contest_id, score, rank, prize_awarded, is_winner, status, submitted_at, answers")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(50);

    const rows = attempts ?? [];
    const cids = Array.from(new Set(rows.map((r) => r.contest_id)));
    let titles: Record<string, string> = {};
    if (cids.length) {
      const { data: cs } = await supabase.from("contests").select("id, title").in("id", cids);
      titles = Object.fromEntries((cs ?? []).map((c) => [c.id, c.title]));
    }

    const totalWon = rows.reduce((s, r) => s + Number(r.prize_awarded || 0), 0);
    const played = rows.length;
    const wins = rows.filter((r) => r.is_winner).length;

    return {
      totalWon,
      played,
      wins,
      history: rows.map((r) => ({
        id: r.id,
        contestId: r.contest_id,
        title: titles[r.contest_id] || "Contest",
        score: Number(r.score ?? 0),
        rank: r.rank,
        prize: Number(r.prize_awarded || 0),
        isWinner: r.is_winner,
        status: r.status,
        submittedAt: r.submitted_at,
      })),
    };
  });

/**
 * Public winners leaderboard — only rows from contests where the admin has
 * declared results. Runs with the service role so it can join across users.
 */
export const getWinnersLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: contests } = await supabaseAdmin
    .from("contests")
    .select("id, title")
    .eq("results_status", "declared");
  const ids = (contests ?? []).map((c) => c.id);
  if (!ids.length) return [];
  const titles = Object.fromEntries((contests ?? []).map((c) => [c.id, c.title]));

  const { data: attempts } = await supabaseAdmin
    .from("contest_attempts")
    .select("id, user_id, contest_id, rank, prize_awarded, score, answers")
    .in("contest_id", ids)
    .eq("is_winner", true)
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(100);

  const userIds = Array.from(new Set((attempts ?? []).map((a) => a.user_id)));
  let names: Record<string, string> = {};
  if (userIds.length) {
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds);
    names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || "Player"]));
  }
  return (attempts ?? []).map((a) => {
    const ans: any = a.answers;
    return {
      attempt_id: a.id,
      name: names[a.user_id] || "Player",
      rank: a.rank ?? 0,
      prize: Number(a.prize_awarded) || 0,
      score: Number(a.score) || 0,
      correct: Number(ans?._correct ?? 0),
      wrong: Number(ans?._wrong ?? 0),
      unanswered: Number(ans?._unanswered ?? 0),
      contest_title: titles[a.contest_id] || "",
    };
  });
});

/**
 * Full result leaderboard for a single (declared) contest. Shows every user's
 * name, score, correct/wrong/unanswered breakdown, and rank.
 */
export const getContestLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ contest_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contest } = await supabaseAdmin
      .from("contests")
      .select("id, title, results_status")
      .eq("id", data.contest_id)
      .maybeSingle();
    if (!contest || contest.results_status !== "declared") {
      return { contest: contest ?? null, rows: [] as any[] };
    }
    const { data: attempts } = await supabaseAdmin
      .from("contest_attempts")
      .select("id, user_id, score, rank, prize_awarded, is_winner, answers")
      .eq("contest_id", data.contest_id)
      .order("rank", { ascending: true, nullsFirst: false });

    const userIds = Array.from(new Set((attempts ?? []).map((a) => a.user_id)));
    let names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds);
      names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || "Player"]));
    }
    const rows = (attempts ?? []).map((a) => {
      const ans: any = a.answers;
      const correct = Number(ans?._correct ?? 0);
      const wrong = Number(ans?._wrong ?? 0);
      const unanswered = Number(ans?._unanswered ?? 0);
      return {
        attempt_id: a.id,
        name: names[a.user_id] || "Player",
        score: Number(a.score) || 0,
        rank: a.rank,
        prize: Number(a.prize_awarded) || 0,
        isWinner: a.is_winner,
        correct,
        wrong,
        unanswered,
      };
    });
    return { contest, rows };
  });
