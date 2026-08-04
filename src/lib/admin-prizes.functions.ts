import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { periodKeyFor } from "@/lib/period-key";

const PERIOD = z.enum(["week", "month", "year"]);

/** Aggregated leaderboard for a period, built from declared contest results. */
export const adminPeriodLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ period: PERIOD }).parse(d))
  .handler(async ({ data }) => {
    const now = new Date();
    const days = data.period === "week" ? 7 : data.period === "month" ? 30 : 365;
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: declared } = await supabaseAdmin
      .from("contests")
      .select("id")
      .eq("results_status", "declared");
    const ids = (declared ?? []).map((c) => c.id);
    if (!ids.length) return { periodKey: periodKeyFor(data.period, now), rows: [] };

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

    const rows = Array.from(agg.values()).sort((a, b) => b.score - a.score || b.prize - a.prize);
    const userIds = rows.map((r) => r.userId);
    let names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, username")
        .in("id", userIds);
      names = Object.fromEntries(
        (profs ?? []).map((p) => [p.id, p.full_name || p.username || p.id.slice(0, 8)]),
      );
    }

    return {
      periodKey: periodKeyFor(data.period, now),
      rows: rows.slice(0, 50).map((r, i) => ({
        ...r,
        rank: i + 1,
        name: names[r.userId] ?? r.userId.slice(0, 8),
      })),
    };
  });

export const adminListPrizeAwards = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { data: awards } = await supabaseAdmin
      .from("prize_awards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const ids = Array.from(new Set((awards ?? []).map((a) => a.user_id)));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, username").in("id", ids);
      names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || p.username || p.id.slice(0, 8)]));
    }
    return (awards ?? []).map((a) => ({ ...a, name: names[a.user_id] ?? a.user_id.slice(0, 8) }));
  });

export const adminAwardPrize = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        period: PERIOD,
        periodKey: z.string().trim().min(2).max(20),
        rank: z.number().int().min(1).max(10000),
        kind: z.enum(["cash", "xp", "box", "physical"]),
        amount: z.number().min(0).max(1000000).default(0),
        description: z.string().trim().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.kind === "cash" && data.amount > 0) {
      const { data: prof, error } = await supabaseAdmin
        .from("profiles")
        .select("wallet_balance")
        .eq("id", data.userId)
        .single();
      if (error) throw new Error(error.message);
      await supabaseAdmin
        .from("profiles")
        .update({ wallet_balance: Number(prof.wallet_balance) + data.amount })
        .eq("id", data.userId);
      await supabaseAdmin.from("transactions").insert({
        user_id: data.userId,
        type: "credit",
        amount: data.amount,
        note: `${data.period} leaderboard prize · rank ${data.rank}`,
      });
    }
    if (data.kind === "xp" && data.amount > 0) {
      await supabaseAdmin.rpc("grant_xp", {
        _user_id: data.userId,
        _amount: Math.round(data.amount),
        _source: `prize_${data.period}`,
        _meta: { rank: data.rank, periodKey: data.periodKey },
      });
    }
    if (data.kind === "box") {
      await supabaseAdmin.from("reward_boxes").insert({
        user_id: data.userId,
        tier: data.rank === 1 ? "gold" : data.rank <= 3 ? "silver" : "bronze",
        source: `prize_${data.period}`,
      });
    }

    const { error } = await supabaseAdmin.from("prize_awards").insert({
      user_id: data.userId,
      period: data.period,
      period_key: data.periodKey,
      rank: data.rank,
      kind: data.kind,
      amount: data.amount,
      description: data.description ?? null,
      status: data.kind === "physical" ? "pending" : "awarded",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdatePrizeStatus = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "awarded", "delivered", "cancelled"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("prize_awards").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
