import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Phase 12 — Universal AI answer grounded in live web search (when configured). */
export const guruWebAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ query: z.string().trim().min(2).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    const { webSearch, formatWebResults } = await import("@/lib/guru-extras.server");
    const { callAiChat } = await import("@/lib/ai-gateway.server");

    const { data: row } = await context.supabase
      .from("guru_student_xp")
      .select("preferred_language")
      .eq("user_id", context.userId)
      .maybeSingle();
    const language = row?.preferred_language ?? "en";

    const search = await webSearch(data.query, 5);
    const sources = formatWebResults(search.results);

    const answer = await callAiChat(
      [
        {
          role: "system",
          content: [
            "You are Guru.AI answering a student's question about current or general knowledge.",
            sources
              ? "Use ONLY the web results below when they are relevant, and cite them as [1], [2] in the text."
              : "No live web results are available, so answer from your own knowledge and say clearly that it is not verified against the web.",
            language === "hi" ? "Reply in simple Hindi (Devanagari)." : "Reply in simple English.",
            "Keep it under 250 words.",
          ].join(" "),
        },
        { role: "user", content: sources ? `Question: ${data.query}\n\nWeb results:\n${sources}` : data.query },
      ],
      { temperature: 0.4 },
    );

    return {
      answer,
      verified: search.verified,
      provider: search.provider,
      note: search.note ?? null,
      results: search.results,
    };
  });

/** Phase 13 — photo doubt solving (question, book page, diagram, code). */
export const guruImageDoubt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        image: z
          .string()
          .trim()
          .min(50)
          .max(8_000_000)
          .refine((v) => v.startsWith("data:image/"), "Please upload an image file"),
        prompt: z.string().trim().max(500).optional(),
        session_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { visionExplain } = await import("@/lib/guru-extras.server");
    const { supabase, userId } = context;

    const { data: row } = await supabase
      .from("guru_student_xp")
      .select("preferred_language, selected_character_id")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: character } = row?.selected_character_id
      ? await supabase
          .from("guru_characters")
          .select("name, teaching_style, tone")
          .eq("id", row.selected_character_id)
          .maybeSingle()
      : { data: null };

    const out = await visionExplain({
      imageDataUrl: data.image,
      prompt: data.prompt ?? null,
      language: row?.preferred_language ?? "en",
      characterStyle: character ? `${character.name} — ${character.teaching_style ?? ""} ${character.tone ?? ""}`.trim() : null,
    });

    let sessionId = data.session_id ?? null;
    if (!sessionId) {
      const { data: created } = await supabase
        .from("guru_ai_sessions")
        .insert({
          user_id: userId,
          scope: "universal",
          character_id: row?.selected_character_id ?? null,
          language: row?.preferred_language ?? "en",
          title: (data.prompt || "Photo doubt").slice(0, 60),
        })
        .select("id")
        .maybeSingle();
      sessionId = created?.id ?? null;
    }
    if (sessionId) {
      await supabase.from("guru_ai_messages").insert([
        {
          user_id: userId,
          session_id: sessionId,
          role: "user",
          content: `📷 Photo doubt: ${data.prompt || "Explain this image"}`,
          intent: "doubt",
        },
        {
          user_id: userId,
          session_id: sessionId,
          role: "assistant",
          content: out.content,
          meta: { provider: out.provider, kind: "vision" },
        },
      ]);
    }

    return { session_id: sessionId, reply: out.content, provider: out.provider };
  });

/** Phase 14 — speak any Guru.AI answer aloud in the student's language. */
export const guruSpeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ text: z.string().trim().min(1).max(3000) }).parse(d))
  .handler(async ({ data }) => {
    const { synthesizeSpeech } = await import("@/lib/tts.server");
    const audio = await synthesizeSpeech(data.text);
    return { audioBase64: audio.base64, mimeType: audio.mimeType, provider: audio.provider };
  });
