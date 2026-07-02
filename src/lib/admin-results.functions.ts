import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listContestAttempts = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ contest_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: attempts, error } = await supabaseAdmin
      .from("contest_attempts")
      .select("id, user_id, score, violations, status, submitted_at, answers, rank, prize_awarded, is_winner")
      .eq("contest_id", data.contest_id)
      .order("score", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((attempts ?? []).map((a) => a.user_id)));
    let profiles: Record<string, { full_name: string | null; phone: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids);
      profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    }
    return (attempts ?? []).map((a) => ({
      ...a,
      profile: profiles[a.user_id] ?? { full_name: null, phone: null },
    }));
  });

export const declareContestResult = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({
      contest_id: z.string().uuid(),
      attempt_id: z.string().uuid(),
      rank: z.number().int().min(1),
      prize: z.number().min(0),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("admin_declare_contest_result", {
      _contest_id: data.contest_id,
      _attempt_id: data.attempt_id,
      _rank: data.rank,
      _prize: data.prize,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setContestResultsDeclared = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({
      contest_id: z.string().uuid(),
      status: z.enum(["pending", "declared"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("contests")
      .update({ results_status: data.status })
      .eq("id", data.contest_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
