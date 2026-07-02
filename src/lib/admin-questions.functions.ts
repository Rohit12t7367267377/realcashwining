import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const questionSchema = z.object({
  category_id: z.string().uuid(),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(10),
  correct_index: z.number().int().min(0),
  explanation: z.string().nullable().optional(),
  difficulty: z.string().min(1),
  time_seconds: z.number().int().min(5).max(600),
});

export const upsertQuestion = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid().optional(), values: questionSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const values = { ...data.values, explanation: data.values.explanation ?? null };
    if (data.values.correct_index >= data.values.options.length) {
      throw new Error("correct_index out of range");
    }
    if (data.id) {
      const { error } = await supabaseAdmin.from("questions").update(values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("questions").insert(values);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
