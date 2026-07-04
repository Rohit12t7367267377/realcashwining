import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const contestSchema = z.object({
  title: z.string().min(1),
  category_id: z.string().uuid().nullable(),
  entry_fee: z.number().min(0),
  prize_pool: z.number().min(0),
  first_prize: z.number().min(0),
  duration_minutes: z.number().int().min(1),
  num_questions: z.number().int().min(1),
  contest_type: z.string().min(1),
  active: z.boolean(),
  max_participants: z.number().int().min(1),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
});

export const upsertContest = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid().optional(), values: contestSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.id) {
      const { error } = await supabaseAdmin.from("contests").update(data.values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("contests").insert(data.values);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteContest = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("contests").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
