import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";
import { z } from "zod";

const passageSchema = z.object({
  title: z.string().trim().min(1).max(200),
  passage: z.string().trim().min(1).max(20000),
  category_id: z.string().uuid().nullable().optional(),
  reading_seconds: z.number().int().min(5).max(3600),
  quiz_seconds: z.number().int().min(10).max(7200),
  num_questions: z.number().int().min(1).max(100),
  difficulty: z.string().min(1).max(20),
  marks_per_question: z.number().min(0).max(100),
  negative_marks: z.number().min(0).max(100),
  keep_passage_visible: z.boolean(),
  shuffle_questions: z.boolean(),
  shuffle_options: z.boolean(),
  show_explanations: z.boolean(),
  entry_fee: z.number().min(0).max(100000),
  prize_pool: z.number().min(0).max(10000000),
  active: z.boolean(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
});

const questionSchema = z.object({
  passage_id: z.string().uuid(),
  question: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  correct_index: z.number().int().min(0).max(5),
  explanation: z.string().max(2000).nullable().optional(),
  marks: z.number().min(0).max(100).nullable().optional(),
  sort_order: z.number().int().min(0).max(1000),
});

export const listReadingPassagesAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reading_passages")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listReadingQuestionsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ passage_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("reading_questions")
      .select("*")
      .eq("passage_id", data.passage_id)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertReadingPassage = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid().optional(), values: passageSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const values = {
      ...data.values,
      category_id: data.values.category_id ?? null,
      starts_at: data.values.starts_at || null,
      ends_at: data.values.ends_at || null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("reading_passages").update(values).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin
      .from("reading_passages")
      .insert(values)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteReadingPassage = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("reading_passages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertReadingQuestion = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid().optional(), values: questionSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.values.correct_index >= data.values.options.length) {
      throw new Error("Correct answer is out of range");
    }
    const values = {
      ...data.values,
      explanation: data.values.explanation || null,
      marks: data.values.marks ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("reading_questions").update(values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("reading_questions").insert(values);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteReadingQuestion = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("reading_questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listReadingAttemptsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ passage_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("reading_attempts")
      .select("id, user_id, score, correct_count, wrong_count, unanswered_count, accuracy, reading_completed, quiz_seconds_spent, status, submitted_at")
      .eq("passage_id", data.passage_id)
      .order("score", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
      names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || "Player"]));
    }
    return (rows ?? []).map((r) => ({ ...r, name: names[r.user_id] ?? "Player" }));
  });
