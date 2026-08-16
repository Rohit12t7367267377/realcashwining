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

/** Admin-only listing: includes the answer key, which clients can no longer read directly. */
export const listQuestions = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ category_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    let q = supabaseAdmin
      .from("questions")
      .select("id, category_id, question, options, correct_index, explanation, difficulty, time_seconds, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.category_id) q = q.eq("category_id", data.category_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Admin-only count (questions columns are restricted for normal clients). */
export const countQuestions = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { count, error } = await supabaseAdmin
      .from("questions")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });
