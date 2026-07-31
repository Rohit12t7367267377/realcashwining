import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppNotification = {
  id: string;
  kind: "broadcast" | "result" | "wallet" | "deposit" | "withdrawal" | "reward" | "mission";
  title: string;
  body: string;
  created_at: string;
  link?: string;
};

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [broadcasts, txns, attempts, boxes, deposits, withdrawals, missions] = await Promise.all([
      supabase
        .from("broadcasts")
        .select("id,title,body,created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("transactions")
        .select("id,type,amount,note,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("contest_attempts")
        .select("id,contest_id,rank,prize_awarded,is_winner,score,submitted_at,status")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("submitted_at", { ascending: false })
        .limit(10),
      supabase
        .from("reward_boxes")
        .select("id,tier,source,created_at")
        .eq("user_id", userId)
        .eq("opened", false)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("deposit_requests")
        .select("id,amount,status,admin_note,created_at,reviewed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("withdrawal_requests")
        .select("id,amount,status,admin_note,created_at,reviewed_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("user_missions")
        .select("id,mission_id,completed_at,claimed_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .is("claimed_at", null)
        .order("completed_at", { ascending: false })
        .limit(10),
    ]);

    const items: AppNotification[] = [];

    for (const b of broadcasts.data ?? []) {
      items.push({
        id: `broadcast:${b.id}`,
        kind: "broadcast",
        title: b.title,
        body: b.body,
        created_at: b.created_at,
      });
    }

    for (const t of txns.data ?? []) {
      items.push({
        id: `txn:${t.id}`,
        kind: "wallet",
        title: t.type === "credit" ? `₹${Number(t.amount).toFixed(2)} credited` : `₹${Number(t.amount).toFixed(2)} debited`,
        body: t.note ?? "Wallet transaction",
        created_at: t.created_at,
        link: "/wallet/history",
      });
    }

    for (const a of attempts.data ?? []) {
      if (a.rank == null && !a.is_winner) continue;
      items.push({
        id: `result:${a.id}`,
        kind: "result",
        title: a.is_winner ? `You won ₹${Number(a.prize_awarded).toFixed(2)}!` : "Contest result declared",
        body: `Rank ${a.rank ?? "-"} · Score ${a.score ?? 0}`,
        created_at: a.submitted_at ?? new Date().toISOString(),
        link: `/result/${a.id}`,
      });
    }

    for (const b of boxes.data ?? []) {
      items.push({
        id: `box:${b.id}`,
        kind: "reward",
        title: `Unopened ${b.tier} reward box`,
        body: "Tap to open your reward box.",
        created_at: b.created_at,
        link: "/rewards",
      });
    }

    for (const d of deposits.data ?? []) {
      items.push({
        id: `dep:${d.id}`,
        kind: "deposit",
        title:
          d.status === "approved"
            ? `Deposit of ₹${Number(d.amount).toFixed(2)} approved`
            : d.status === "rejected"
              ? `Deposit of ₹${Number(d.amount).toFixed(2)} rejected`
              : `Deposit of ₹${Number(d.amount).toFixed(2)} pending review`,
        body: d.admin_note ?? (d.status === "pending" ? "Admin will review shortly." : "Check your wallet."),
        created_at: d.reviewed_at ?? d.created_at,
        link: "/wallet",
      });
    }

    for (const w of withdrawals.data ?? []) {
      items.push({
        id: `wd:${w.id}`,
        kind: "withdrawal",
        title:
          w.status === "approved" || w.status === "paid"
            ? `Withdrawal of ₹${Number(w.amount).toFixed(2)} approved`
            : w.status === "rejected"
              ? `Withdrawal of ₹${Number(w.amount).toFixed(2)} rejected`
              : `Withdrawal of ₹${Number(w.amount).toFixed(2)} pending`,
        body: w.admin_note ?? "Track status in your wallet.",
        created_at: w.reviewed_at ?? w.created_at,
        link: "/wallet",
      });
    }

    const missionRows = missions.data ?? [];
    if (missionRows.length) {
      const ids = Array.from(new Set(missionRows.map((m) => m.mission_id)));
      const { data: defs } = await supabase.from("missions").select("id,title,reward_xp,reward_coins").in("id", ids);
      const byId = new Map((defs ?? []).map((d) => [d.id, d]));
      for (const m of missionRows) {
        const def = byId.get(m.mission_id);
        items.push({
          id: `mission:${m.id}`,
          kind: "mission",
          title: `Mission complete: ${def?.title ?? "Mission"}`,
          body: `Claim ${def?.reward_xp ?? 0} XP${Number(def?.reward_coins ?? 0) > 0 ? ` + ₹${Number(def?.reward_coins).toFixed(2)}` : ""}.`,
          created_at: m.completed_at ?? new Date().toISOString(),
          link: "/missions",
        });
      }
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return { items: items.slice(0, 60) };
  });
