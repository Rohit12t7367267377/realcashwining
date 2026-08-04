// Server-only text-to-speech. Prefers ElevenLabs (connector key) and falls back
// to the Lovable AI gateway TTS models.

const ELEVEN_DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah
const GATEWAY_TTS_URL = "https://ai.gateway.lovable.dev/v1/audio/speech";

export type SpeechResult = { base64: string; mimeType: string; provider: string };

export async function synthesizeSpeech(text: string, voiceId?: string): Promise<SpeechResult> {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (elevenKey) {
    const voice = voiceId || ELEVEN_DEFAULT_VOICE;
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
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
    body: JSON.stringify({ model: "google/gemini-2.5-flash-tts", input: text, voice: "Kore" }),
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
