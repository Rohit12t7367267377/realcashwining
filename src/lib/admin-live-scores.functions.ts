import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const scoreSchema = z.object({
  sport: z.string().min(1).max(40),
  league: z.string().max(120).optional().nullable(),
  home_team: z.string().min(1).max(80),
  away_team: z.string().min(1).max(80),
  home_score: z.string().max(40),
  away_score: z.string().max(40),
  status: z.string().max(60),
  match_time: z.string().max(60).optional().nullable(),
  is_live: z.boolean(),
  sort_order: z.number().int().default(0),
});

export const upsertLiveScore = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), values: scoreSchema }).parse(d))
  .handler(async ({ data }) => {
    if (data.id) {
      const { error } = await supabaseAdmin.from("live_scores").update(data.values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("live_scores").insert(data.values);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteLiveScore = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("live_scores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
