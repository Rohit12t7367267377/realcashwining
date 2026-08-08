import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiChat, extractJson } from "@/lib/ai-gateway.server";

async function getAiConfig() {
  const { data } = await supabaseAdmin.from("app_settings").select("key, value").in("key", [
    "ai_enabled", "ai_model", "ai_gen_enabled",
  ]);
  const map = new Map<string, unknown>((data ?? []).map((r) => [r.key, r.value]));
  const asBool = (v: unknown, d = true) => (v === false || v === "false" ? false : v === true || v === "true" ? true : d);
  const asStr = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  return {
    enabled: asBool(map.get("ai_enabled"), true),
    genEnabled: asBool(map.get("ai_gen_enabled"), true),
    model: asStr(map.get("ai_model"), "google/gemini-3-flash-preview"),
  };
}

export const adminGenerateQuestions = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({
      category_id: z.string().uuid(),
      count: z.number().int().min(1).max(25),
      difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
      topic_hint: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const cfg = await getAiConfig();
    if (!cfg.enabled || !cfg.genEnabled) throw new Error("AI question generation is disabled.");

    const { data: cat } = await supabaseAdmin.from("categories").select("id, name").eq("id", data.category_id).maybeSingle();
    if (!cat) throw new Error("Category not found");

    const prompt = `Generate ${data.count} multiple-choice quiz questions for category "${cat.name}"${data.topic_hint ? ` on the topic: ${data.topic_hint}` : ""}. Difficulty: ${data.difficulty}.
Return STRICT JSON only, no prose, no code fences:
{"questions":[{"question":"...","options":["A","B","C","D"],"correct_index":0,"explanation":"one sentence"}]}
Rules:
- Exactly 4 options per question.
- correct_index is 0..3 pointing to the right option.
- Questions must be factually accurate, unique, and suitable for a general audience in India.
- Keep each question under 200 characters, each option under 80 characters.`;

    const raw = await callAiChat(
      [
        { role: "system", content: "You output only valid minified JSON. No prose, no code fences." },
        { role: "user", content: prompt },
      ],
      { model: cfg.model, temperature: 0.7, responseFormat: "json_object" },
    );

    const parsed = extractJson(raw) as { questions?: Array<{ question?: string; options?: string[]; correct_index?: number; explanation?: string }> };
    const items = (parsed.questions ?? [])
      .filter((q) =>
        typeof q.question === "string" && q.question.trim().length > 0 &&
        Array.isArray(q.options) && q.options.length === 4 &&
        q.options.every((o) => typeof o === "string" && o.trim().length > 0) &&
        Number.isInteger(q.correct_index) && (q.correct_index as number) >= 0 && (q.correct_index as number) < 4,
      )
      .map((q) => ({
        category_id: data.category_id,
        question: q.question!.trim().slice(0, 500),
        options: q.options!.map((o) => o.trim().slice(0, 200)),
        correct_index: q.correct_index as number,
        explanation: (q.explanation ?? "").toString().slice(0, 500) || null,
      }));

    if (items.length === 0) throw new Error("AI produced no valid questions. Try again or refine the topic.");

    const { error } = await supabaseAdmin.from("questions").insert(items);
    if (error) throw new Error(error.message);
    return { inserted: items.length };
  });

const aiSettingsSchema = z.object({
  ai_enabled: z.boolean().optional(),
  ai_model: z.string().min(1).max(100).optional(),
  ai_gen_enabled: z.boolean().optional(),
  ai_recs_enabled: z.boolean().optional(),
  ai_doubt_enabled: z.boolean().optional(),
  ai_doubt_system_prompt: z.string().min(1).max(2000).optional(),
});

export const saveAiSettings = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => aiSettingsSchema.parse(d))
  .handler(async ({ data }) => {
    const entries = Object.entries(data);
    for (const [key, value] of entries) {
      if (value === undefined) continue;
      const { error } = await supabaseAdmin
        .from("app_settings")
        .upsert({ key, value: value as never }, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const readAiSettingsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { data } = await supabaseAdmin.from("app_settings").select("key, value").in("key", [
      "ai_enabled", "ai_model", "ai_gen_enabled", "ai_recs_enabled",
      "ai_doubt_enabled", "ai_doubt_system_prompt",
    ]);
    const asBool = (v: unknown, d: boolean) => (v === false || v === "false" ? false : v === true || v === "true" ? true : d);
    const asStr = (v: unknown, d: string) => (typeof v === "string" ? v : d);
    const map = new Map<string, unknown>((data ?? []).map((r) => [r.key, r.value]));
    return {
      ai_enabled: asBool(map.get("ai_enabled"), true),
      ai_model: asStr(map.get("ai_model"), "google/gemini-3-flash-preview"),
      ai_gen_enabled: asBool(map.get("ai_gen_enabled"), true),
      ai_recs_enabled: asBool(map.get("ai_recs_enabled"), true),
      ai_doubt_enabled: asBool(map.get("ai_doubt_enabled"), true),
      ai_doubt_system_prompt: asStr(map.get("ai_doubt_system_prompt"), ""),
    };
  });

export const listAllCategories = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { data } = await supabaseAdmin.from("categories").select("id, name").order("name");
    return data ?? [];
  });

/**
 * AI generator for Reading Comprehension: writes a passage for any category
 * (Sports, General Knowledge, Coding, etc.) plus its MCQs in one shot.
 * The passage is created INACTIVE so admin can review/edit before publishing.
 */
export const adminGenerateReadingPassage = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({
      category_id: z.string().uuid().nullable().optional(),
      topic_hint: z.string().max(200).optional(),
      num_questions: z.number().int().min(2).max(15).default(5),
      word_count: z.number().int().min(80).max(700).default(250),
      difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("medium"),
      reading_seconds: z.number().int().min(15).max(3600).default(120),
      quiz_seconds: z.number().int().min(30).max(7200).default(180),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const cfg = await getAiConfig();
    if (!cfg.enabled || !cfg.genEnabled) throw new Error("AI generation is disabled.");

    let catName = "General Knowledge";
    if (data.category_id) {
      const { data: cat } = await supabaseAdmin
        .from("categories").select("id, name").eq("id", data.category_id).maybeSingle();
      if (!cat) throw new Error("Category not found");
      catName = cat.name;
    }

    const prompt = `Write an original reading-comprehension exercise for the category "${catName}"${data.topic_hint ? ` about: ${data.topic_hint}` : ""}.
Passage length: about ${data.word_count} words. Difficulty: ${data.difficulty}.
Then write ${data.num_questions} multiple-choice questions answerable ONLY from the passage.
Return STRICT minified JSON only, no prose, no code fences:
{"title":"...","passage":"...","questions":[{"question":"...","options":["A","B","C","D"],"correct_index":0,"explanation":"one sentence citing the passage"}]}
Rules:
- Exactly 4 options per question, correct_index 0..3.
- Factually accurate, self-contained, suitable for a general audience in India.
- Do not use markdown inside the passage.`;

    const raw = await callAiChat(
      [
        { role: "system", content: "You output only valid minified JSON. No prose, no code fences." },
        { role: "user", content: prompt },
      ],
      { model: cfg.model, temperature: 0.8, responseFormat: "json_object" },
    );

    const parsed = extractJson(raw) as {
      title?: string;
      passage?: string;
      questions?: Array<{ question?: string; options?: string[]; correct_index?: number; explanation?: string }>;
    };

    const passage = (parsed.passage ?? "").toString().trim();
    if (passage.length < 50) throw new Error("AI produced no usable passage. Try again.");
    const title = ((parsed.title ?? "").toString().trim() || `${catName} Reading Practice`).slice(0, 200);

    const questions = (parsed.questions ?? [])
      .filter((q) =>
        typeof q.question === "string" && q.question.trim().length > 0 &&
        Array.isArray(q.options) && q.options.length === 4 &&
        q.options.every((o) => typeof o === "string" && o.trim().length > 0) &&
        Number.isInteger(q.correct_index) && (q.correct_index as number) >= 0 && (q.correct_index as number) < 4,
      )
      .slice(0, data.num_questions);
    if (questions.length < 2) throw new Error("AI produced too few valid questions. Try again.");

    const { data: created, error: pErr } = await supabaseAdmin
      .from("reading_passages")
      .insert({
        title,
        passage: passage.slice(0, 20000),
        category_id: data.category_id ?? null,
        reading_seconds: data.reading_seconds,
        quiz_seconds: data.quiz_seconds,
        num_questions: questions.length,
        difficulty: data.difficulty === "mixed" ? "medium" : data.difficulty,
        marks_per_question: 1,
        negative_marks: 0,
        keep_passage_visible: true,
        shuffle_questions: false,
        shuffle_options: false,
        show_explanations: true,
        entry_fee: 0,
        prize_pool: 0,
        active: false,
      })
      .select("id, title")
      .single();
    if (pErr || !created) throw new Error(pErr?.message ?? "Failed to create passage");

    const { error: qErr } = await supabaseAdmin.from("reading_questions").insert(
      questions.map((q, i) => ({
        passage_id: created.id,
        question: q.question!.trim().slice(0, 2000),
        options: q.options!.map((o) => o.trim().slice(0, 500)),
        correct_index: q.correct_index as number,
        explanation: (q.explanation ?? "").toString().slice(0, 2000) || null,
        marks: 1,
        sort_order: i,
      })),
    );
    if (qErr) throw new Error(qErr.message);

    return { passage_id: created.id, title: created.title, questions: questions.length };
  });
