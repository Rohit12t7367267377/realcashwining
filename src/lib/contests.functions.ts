import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Atomically joins a contest: charges the entry fee (once) and creates the
 * contest_attempts row. If the user has already joined, returns their existing
 * attempt without charging again. This prevents the "wallet debited but I
 * never actually played" problem.
 */
export const joinContest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contest_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("join_contest", { _contest_id: data.contest_id });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      attempt_id: row?.attempt_id as string,
      charged: Number(row?.charged ?? 0),
      already: Boolean(row?.already),
    };
  });
