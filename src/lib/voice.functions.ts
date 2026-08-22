import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Voice assistant: answers a study question and returns spoken audio.
 * Uses ElevenLabs when the connector key is available, otherwise falls back to
 * the Lovable AI text-to-speech models so voice always works.
 */
export const speakAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        question: z.string().trim().min(2).max(600),
        voiceId: z.string().trim().max(60).optional(),
        lang: z.enum(["en", "hi"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { callAiChat } = await import("@/lib/ai-gateway.server");
    const { synthesizeSpeech } = await import("@/lib/tts.server");

    const answer = await callAiChat(
      [
        {
          role: "system",
          content:
            data.lang === "hi"
              ? "आप Guru.AI हैं, एक भारतीय क्विज़ ऐप का दोस्ताना स्टडी वॉइस असिस्टेंट। अधिकतम 4 छोटे वाक्यों में, सरल बोलचाल की हिंदी में उत्तर दें। कोई markdown नहीं।"
              : "You are Guru.AI, a friendly study voice assistant for an Indian quiz app. Answer in at most 4 short sentences, plain spoken language, no markdown.",
        },
        { role: "user", content: data.question },
      ],
      { temperature: 0.6, model: "google/gemini-3.7-flash" },
    );

    const audio = await synthesizeSpeech(answer, data.voiceId);
    return { answer, audioBase64: audio.base64, mimeType: audio.mimeType, provider: audio.provider };
  });
