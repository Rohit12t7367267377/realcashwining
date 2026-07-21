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
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    return map as Record<string, unknown>;
  });

export const listAllCategories = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { data } = await supabaseAdmin.from("categories").select("id, name").order("name");
    return data ?? [];
  });
