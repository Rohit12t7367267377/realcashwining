import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SCOPES = ["school", "college", "exam", "skill", "galaxy", "universal", "library", "classroom"] as const;
const MODES = [
  "start", "again", "easier", "harder", "deeper", "example",
  "ask_me", "practice", "test", "doubt", "revise", "next",
] as const;

const turnInput = z.object({
  scope: z.enum(SCOPES).default("universal"),
  refId: z.string().uuid().optional(),
  topicKey: z.string().trim().max(200).optional(),
  topic: z.string().trim().min(2).max(300),
  subject: z.string().trim().max(120).optional(),
  levelLabel: z.string().trim().max(160).optional(),
  material: z.string().trim().max(6000).optional(),
  mode: z.enum(MODES).default("start"),
  level: z.number().int().min(1).max(5).default(3),
  studentText: z.string().trim().max(1200).optional(),
  history: z
    .array(z.object({ role: z.enum(["teacher", "student"]), content: z.string().max(1200) }))
    .max(12)
    .optional(),
});

/**
 * ONE teaching turn from the central Guru.AI teaching engine.
 * Every education module (School, College, Exams, Skills, Galaxy, Universal AI)
 * calls this with its own context.
 */
export const guruEngineTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => turnInput.parse(d))
  .handler(async ({ context, data }) => {
    const { resolveTeachingContext, runTeachTurn } = await import("@/lib/guru-engine.server");
    const db = context.supabase as never as Parameters<typeof resolveTeachingContext>[0];

    const ctx = {
      scope: data.scope,
      refId: data.refId ?? null,
      topicKey: data.topicKey ?? null,
      topic: data.topic,
      subject: data.subject ?? null,
      levelLabel: data.levelLabel ?? null,
      material: data.material ?? null,
    };

    const resolved = await resolveTeachingContext(db, context.userId, ctx);
    const turn = await runTeachTurn({
      ctx,
      resolved,
      mode: data.mode,
      level: data.level,
      studentText: data.studentText ?? null,
      history: data.history,
    });

    return {
      ...turn,
      level: data.level,
      mode: data.mode,
      language: resolved.language,
      premium: resolved.premium,
      configured: Boolean(resolved.config),
      groundedSources: resolved.sources ? true : false,
      teacher: {
        id: resolved.teacher.characterId,
        name: resolved.teacher.name,
        emoji: resolved.teacher.emoji,
        avatarStyle: resolved.teacher.avatarStyle,
        accentColor: resolved.teacher.accentColor,
        specialization: resolved.teacher.specialization,
        voiceLabel: resolved.teacher.voice.label,
        voiceCode: resolved.teacher.voice.code,
      },
    };
  });

/** Speak a lesson line with the teacher's own configured voice (falls back automatically). */
export const guruEngineSpeak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        text: z.string().trim().min(1).max(3000),
        characterId: z.string().uuid().optional(),
        voiceCode: z.string().trim().max(60).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { resolveTeacherVoice } = await import("@/lib/guru-engine.voice.server");
    const { synthesizeSpeech } = await import("@/lib/tts.server");
    const voice = await resolveTeacherVoice(context.supabase as never, context.userId, {
      characterId: data.characterId ?? null,
      voiceCode: data.voiceCode ?? null,
    });
    const audio = await synthesizeSpeech(data.text, {
      voiceId: voice.voiceId,
      fallbackVoiceId: voice.fallbackVoiceId,
      speed: voice.speed,
      provider: voice.provider,
    });
    return { audioBase64: audio.base64, mimeType: audio.mimeType, provider: audio.provider, voiceLabel: voice.label };
  });

/** Voices a student can preview and choose from. */
export const guruListVoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("guru_voices")
      .select("code, label, language, accent, gender, style, speed, is_default")
      .eq("active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    const { data: pref } = await context.supabase
      .from("guru_student_xp")
      .select("preferred_voice_code, preferred_voice_speed")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      voices: data ?? [],
      preferredVoice: (pref?.preferred_voice_code as string | null) ?? null,
      preferredSpeed: Number(pref?.preferred_voice_speed ?? 1) || 1,
    };
  });

/** Save (or reset) the student's voice preference. */
export const guruSaveVoicePreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        voiceCode: z.string().trim().max(60).nullable().optional(),
        speed: z.number().min(0.5).max(1.5).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const patch: Record<string, unknown> = { user_id: context.userId };
    patch.preferred_voice_code = data.voiceCode?.trim() ? data.voiceCode.trim() : null;
    if (typeof data.speed === "number") patch.preferred_voice_speed = data.speed;
    const { error } = await context.supabase.from("guru_student_xp").upsert(patch as never, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
