import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Board lesson — the AI 2D teacher character writes short lines on a whiteboard
 * and speaks a teaching script for any topic the student asks about.
 */
export const guruBoardLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        topic: z.string().trim().min(2).max(300),
        context: z.string().trim().max(1500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { callAiChat, extractJson } = await import("@/lib/ai-gateway.server");

    const { data: row } = await context.supabase
      .from("guru_student_xp")
      .select("preferred_language, selected_character_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    const language = row?.preferred_language === "hi" ? "hi" : "en";

    const { data: character } = row?.selected_character_id
      ? await context.supabase
          .from("guru_characters")
          .select("name, teaching_style, tone")
          .eq("id", row.selected_character_id)
          .maybeSingle()
      : { data: null };

    const raw = await callAiChat(
      [
        {
          role: "system",
          content: [
            "You are a 2D animated classroom teacher explaining a topic on a whiteboard.",
            character?.name ? `Your name is ${character.name} (${character.teaching_style ?? ""} ${character.tone ?? ""}).` : "",
            language === "hi" ? "Write everything in simple Hindi (Devanagari)." : "Write everything in simple English.",
            "Return STRICT JSON only:",
            '{"title":"short board heading","lines":["board point 1", "..."],"speech":"what the teacher says aloud","summary":"1 line takeaway"}',
            "lines: 4 to 7 very short board points (max 70 characters each), like real chalk notes; may include a formula.",
            "speech: 90-140 words, warm classroom tone, no markdown, no emojis.",
          ]
            .filter(Boolean)
            .join(" "),
        },
        {
          role: "user",
          content: data.context ? `Teach this topic: ${data.topic}\n\nPage context:\n${data.context}` : `Teach this topic: ${data.topic}`,
        },
      ],
      { temperature: 0.6, model: "google/gemini-3.7-flash", responseFormat: "json_object" },
    );

    const parsed = extractJson(raw) as {
      title?: string;
      lines?: unknown;
      speech?: string;
      summary?: string;
    };

    const lines = Array.isArray(parsed.lines)
      ? parsed.lines.map((l) => String(l)).filter(Boolean).slice(0, 7)
      : [];

    return {
      title: String(parsed.title ?? data.topic).slice(0, 80),
      lines: lines.length ? lines : [String(data.topic)],
      speech: String(parsed.speech ?? "").slice(0, 2000),
      summary: parsed.summary ? String(parsed.summary).slice(0, 200) : null,
      language,
      teacher: character?.name ?? "Guru",
    };
  });
