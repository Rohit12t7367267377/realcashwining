import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";

export const getAutomationSettings = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { readAutomationSettings } = await import("@/lib/automation.server");
    return await readAutomationSettings();
  });

export const saveAutomationSettings = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        auto_quiz_generation: z.boolean(),
        auto_result: z.boolean(),
        auto_leaderboard: z.boolean(),
        auto_prize_distribution: z.boolean(),
        prize_split: z.array(z.number().min(0).max(100)).max(20),
        leaderboard_prizes: z.object({
          week: z.array(z.number().min(0)).max(20),
          month: z.array(z.number().min(0)).max(20),
          year: z.array(z.number().min(0)).max(20),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const rows = Object.entries(data).map(([key, value]) => ({ key, value, updated_at: now }));
    const { error } = await supabaseAdmin.from("app_settings").upsert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Manual override: run the whole automation pass right now. */
export const runAutomationNow = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { runAutoResults, runAutoLeaderboardPrizes } = await import("@/lib/automation.server");
    const { runSportsAutomation } = await import("@/lib/sports.server");
    const sports = await runSportsAutomation().catch(() => ({ enabled: false, drafted: 0, finalized: [], waiting: [] }));
    const results = await runAutoResults();
    const week = await runAutoLeaderboardPrizes("week");
    const month = await runAutoLeaderboardPrizes("month");
    return { results, week, month, sports };
  });

/** Manual override: finalize one specific contest immediately. */
export const finalizeContestNow = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ contest_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { finalizeContest } = await import("@/lib/automation.server");
    return await finalizeContest(data.contest_id);
  });

/** Contests that have ended but are still awaiting results. */
export const listPendingFinalization = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("contests")
      .select("id, title, ends_at, results_status, prize_pool, first_prize")
      .eq("results_status", "pending")
      .order("ends_at", { ascending: true })
      .limit(50);
    return data ?? [];
  });
