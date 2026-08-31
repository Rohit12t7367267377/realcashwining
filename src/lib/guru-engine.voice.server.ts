/** Server-only voice resolution for the Guru.AI teaching engine. */
type Db = { from: (t: string) => any };

export type ResolvedVoice = {
  provider: string;
  voiceId: string;
  fallbackVoiceId: string | null;
  speed: number;
  label: string;
  code: string | null;
};

const DEFAULT: ResolvedVoice = {
  provider: "lovable",
  voiceId: "alloy",
  fallbackVoiceId: "alloy",
  speed: 1,
  label: "Alloy",
  code: "alloy",
};

async function voiceByCode(db: Db, code?: string | null) {
  if (!code) return null;
  const { data } = await db.from("guru_voices").select("*").eq("code", code).eq("active", true).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * Voice priority: explicit request > student preference > character voice >
 * character fallback voice > platform default.
 */
export async function resolveTeacherVoice(
  supabase: Db,
  userId: string,
  args: { characterId?: string | null; voiceCode?: string | null },
): Promise<ResolvedVoice> {
  const { data: student } = await supabase
    .from("guru_student_xp")
    .select("preferred_voice_code, preferred_voice_speed, selected_character_id")
    .eq("user_id", userId)
    .maybeSingle();
  const s = (student as Record<string, unknown> | null) ?? null;

  const characterId = args.characterId ?? (s?.selected_character_id as string | null) ?? null;
  let character: Record<string, unknown> | null = null;
  if (characterId) {
    const { data } = await supabase.from("guru_characters").select("*").eq("id", characterId).maybeSingle();
    character = (data as Record<string, unknown> | null) ?? null;
  }

  const row =
    (await voiceByCode(supabase, args.voiceCode)) ??
    (await voiceByCode(supabase, (s?.preferred_voice_code as string | null) ?? null)) ??
    (await voiceByCode(supabase, (character?.voice_code as string | null) ?? null)) ??
    (await voiceByCode(supabase, (character?.fallback_voice_code as string | null) ?? null));

  const fallback = await voiceByCode(supabase, (character?.fallback_voice_code as string | null) ?? "alloy");
  const speed =
    Number(s?.preferred_voice_speed ?? character?.voice_speed ?? row?.speed ?? 1) || 1;

  if (!row) return { ...DEFAULT, speed };
  return {
    provider: String(row.provider ?? "lovable"),
    voiceId: String(row.voice_id ?? "alloy"),
    fallbackVoiceId: fallback ? String(fallback.voice_id) : "alloy",
    speed,
    label: String(row.label ?? "Voice"),
    code: String(row.code ?? ""),
  };
}
