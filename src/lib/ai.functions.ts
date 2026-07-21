import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAiChat, extractJson, type ChatMessage } from "@/lib/ai-gateway.server";

// Small helper — read AI feature settings from public.app_settings (no auth needed).
async function readAiSettings(supabase: {
  from: (t: string) => {
    select: (c: string) => {
      in: (col: string, arr: string[]) => Promise<{ data: Array<{ key: string; value: unknown }> | null }>;
    };
  };
}) {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", [
    "ai_enabled", "ai_model", "ai_gen_enabled", "ai_recs_enabled",
    "ai_doubt_enabled", "ai_doubt_system_prompt",
  ]);
  const map = new Map<string, unknown>((data ?? []).map((r) => [r.key, r.value]));
  const asBool = (v: unknown, d = true) => (v === false || v === "false" ? false : v === true || v === "true" ? true : d);
  const asStr = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  return {
    enabled: asBool(map.get("ai_enabled"), true),
    model: asStr(map.get("ai_model"), "google/gemini-3-flash-preview"),
    genEnabled: asBool(map.get("ai_gen_enabled"), true),
    recsEnabled: asBool(map.get("ai_recs_enabled"), true),
    doubtEnabled: asBool(map.get("ai_doubt_enabled"), true),
    doubtPrompt: asStr(
      map.get("ai_doubt_system_prompt"),
      "You are a friendly quiz tutor for the Cash Winning League app. Explain concepts clearly and concisely. If the user asks in Hindi, reply in Hindi. Never reveal answers to active contest questions.",
    ),
  };
}

// ────────────────────────────────────────────────────────────
// AI Recommendations — suggest active contests personalized for the user
// ────────────────────────────────────────────────────────────
export const aiRecommendContests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const settings = await readAiSettings(supabase as never);
    if (!settings.enabled || !settings.recsEnabled) return { enabled: false, items: [] };

    // Candidate active contests
    const nowIso = new Date().toISOString();
    const { data: contests } = await supabase
      .from("contests")
      .select("id, title, entry_fee, first_prize, category_id, starts_at, ends_at")
      .eq("active", true)
      .eq("results_status", "pending")
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .limit(30);

    if (!contests || contests.length === 0) return { enabled: true, items: [] };

    // User signal: recent categories played + wins
    const { data: recent } = await supabase
      .from("contest_attempts")
      .select("contest_id, is_winner, score, submitted_at")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(20);
    const { data: cats } = await supabase.from("categories").select("id, name");
    const catName = new Map((cats ?? []).map((c) => [c.id, c.name]));

    const prompt = `You are a recommendation engine for a quiz app.
Return STRICT JSON only: {"items":[{"contest_id":"<uuid>","reason":"<max 90 chars, friendly, English>"}]}
Pick the top 3 contests from the list below, best-matched to the user's recent activity.
If the user has no history, prioritise free entry and biggest first prize.

Active contests:
${contests.map((c) => `- id=${c.id} title="${c.title}" entry=${c.entry_fee} prize=${c.first_prize} category=${(c.category_id && catName.get(c.category_id)) || "?"}`).join("\n")}

Recent activity: ${(recent ?? []).length} attempts, ${(recent ?? []).filter((r) => r.is_winner).length} wins.`;

    const raw = await callAiChat(
      [
        { role: "system", content: "You output only valid minified JSON. No prose, no code fences." },
        { role: "user", content: prompt },
      ],
      { model: settings.model, temperature: 0.4, responseFormat: "json_object" },
    );
    let parsed: { items?: Array<{ contest_id: string; reason: string }> } = {};
    try { parsed = extractJson(raw) as typeof parsed; } catch { parsed = {}; }
    const valid = new Set(contests.map((c) => c.id));
    const items = (parsed.items ?? [])
      .filter((i) => typeof i?.contest_id === "string" && valid.has(i.contest_id))
      .slice(0, 3)
      .map((i) => {
        const c = contests.find((x) => x.id === i.contest_id)!;
        return {
          contest_id: c.id,
          title: c.title,
          entry_fee: Number(c.entry_fee ?? 0),
          first_prize: Number(c.first_prize ?? 0),
          reason: String(i.reason ?? "").slice(0, 120),
        };
      });
    return { enabled: true, items };
  });

// ────────────────────────────────────────────────────────────
// AI Doubt Assistant — chat, persisted per user
// ────────────────────────────────────────────────────────────
export const listMyAiChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ai_chat_messages" as never)
      .select("id, role, content, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(200);
    return (data ?? []) as Array<{ id: string; role: string; content: string; created_at: string }>;
  });

export const clearMyAiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("ai_chat_messages" as never).delete().eq("user_id", context.userId);
    return { ok: true };
  });

export const askAiDoubt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ message: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const settings = await readAiSettings(context.supabase as never);
    if (!settings.enabled || !settings.doubtEnabled) throw new Error("AI Doubt Assistant is disabled by admin.");

    // Load last ~20 messages for context
    const { data: hist } = await context.supabase
      .from("ai_chat_messages" as never)
      .select("role, content")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    const history = ((hist ?? []) as Array<{ role: string; content: string }>).reverse();

    const messages: ChatMessage[] = [
      { role: "system", content: settings.doubtPrompt },
      ...history.map((m) => ({ role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user", content: m.content })),
      { role: "user", content: data.message },
    ];

    // Persist user message first so it's visible even if AI fails
    await context.supabase.from("ai_chat_messages" as never).insert({
      user_id: context.userId, role: "user", content: data.message,
    });

    const reply = await callAiChat(messages, { model: settings.model, temperature: 0.5 });

    await context.supabase.from("ai_chat_messages" as never).insert({
      user_id: context.userId, role: "assistant", content: reply,
    });
    return { reply };
  });
