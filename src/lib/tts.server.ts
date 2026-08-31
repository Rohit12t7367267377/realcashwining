// Server-only text-to-speech. Prefers ElevenLabs (connector key) and falls back
// to the Lovable AI gateway TTS models.

const ELEVEN_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah
const GATEWAY_TTS_URL = "https://ai.gateway.lovable.dev/v1/audio/speech";

export type SpeechResult = { base64: string; mimeType: string; provider: string };

export type SpeechOptions = {
  /** Provider voice id (ElevenLabs voice id, or gateway voice name). */
  voiceId?: string | null;
  /** Used when the primary voice is rejected by the provider. */
  fallbackVoiceId?: string | null;
  /** 0.5 – 1.5 */
  speed?: number | null;
  /** "elevenlabs" | "lovable" — a hint only; fallback always applies. */
  provider?: string | null;
};

export async function synthesizeSpeech(
  text: string,
  options?: string | SpeechOptions,
): Promise<SpeechResult> {
  const opts: SpeechOptions = typeof options === "string" ? { voiceId: options } : options ?? {};
  const clean = text.slice(0, 3000);
  const speed = Math.max(0.5, Math.min(1.5, Number(opts.speed ?? 1) || 1));
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (elevenKey && opts.provider !== "lovable") {
    const voice = opts.voiceId || ELEVEN_DEFAULT_VOICE;

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, model_id: "eleven_multilingual_v2" }),
      },
    );
    if (res.ok) {
      const buf = await res.arrayBuffer();
      return { base64: Buffer.from(buf).toString("base64"), mimeType: "audio/mpeg", provider: "elevenlabs" };
    }
    // fall through to the gateway when ElevenLabs rejects the request
  }

  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Voice is not configured yet.");
  const res = await fetch(GATEWAY_TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini-tts",
      input: clean,
      voice: "alloy",
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Voice service is busy. Try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Ask the admin to top up.");
    throw new Error(`Voice request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const buf = await res.arrayBuffer();
  return { base64: Buffer.from(buf).toString("base64"), mimeType: "audio/mpeg", provider: "lovable-ai" };
}
