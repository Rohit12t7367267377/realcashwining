// Server-only providers for Guru.AI Phase 12 (web search), Phase 13 (image
// doubt / vision) and Phase 14 (voice output). Every provider is abstracted so
// it can be swapped later without touching the frontend.

const GATEWAY_CHAT = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-3-flash-preview";

export type WebResult = { title: string; url: string; snippet: string };
export type WebSearchOutcome = {
  provider: string;
  verified: boolean;
  results: WebResult[];
  note?: string;
};

/**
 * SearchProvider abstraction: uses Tavily or Serper when a key is configured,
 * otherwise reports that no live search provider is available (the caller then
 * answers from AI knowledge and marks the answer as unverified).
 */
export async function webSearch(query: string, limit = 5): Promise<WebSearchOutcome> {
  const tavily = process.env.TAVILY_API_KEY;
  const serper = process.env.SERPER_API_KEY;

  try {
    if (tavily) {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: tavily, query, max_results: limit, search_depth: "basic" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
        return {
          provider: "tavily",
          verified: true,
          results: (data.results ?? []).slice(0, limit).map((r) => ({
            title: r.title ?? "Result",
            url: r.url ?? "",
            snippet: (r.content ?? "").slice(0, 500),
          })),
        };
      }
    }
    if (serper) {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serper, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: limit }),
      });
      if (res.ok) {
        const data = (await res.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
        return {
          provider: "serper",
          verified: true,
          results: (data.organic ?? []).slice(0, limit).map((r) => ({
            title: r.title ?? "Result",
            url: r.link ?? "",
            snippet: (r.snippet ?? "").slice(0, 500),
          })),
        };
      }
    }
  } catch {
    /* fall through to unverified mode */
  }

  return {
    provider: "none",
    verified: false,
    results: [],
    note: "No live web search provider is configured, so this answer comes from the AI's own knowledge and is not verified against the web.",
  };
}

export function formatWebResults(results: WebResult[]): string {
  if (results.length === 0) return "";
  return results
    .map((r, i) => `[[Web ${i + 1}: ${r.title}]] ${r.url}\n${r.snippet}`)
    .join("\n\n");
}

/** VisionProvider abstraction: read a photo of a question/diagram and teach it. */
export async function visionExplain(args: {
  imageDataUrl: string;
  prompt?: string | null;
  language?: string;
  characterStyle?: string | null;
}): Promise<{ content: string; provider: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured yet. Please ask the admin to enable AI.");

  const system = [
    "You are Guru.AI, a patient Indian tutor helping a school student who has photographed a question, book page, diagram or coding problem.",
    "Steps: 1) state what the question asks, 2) name the subject/topic, 3) teach the solution step by step in simple language, 4) give the final answer, 5) end with one short practice question.",
    "Never shame the student. Keep it under 300 words. No markdown tables.",
    args.characterStyle ? `Teach in this style: ${args.characterStyle}.` : "",
    args.language === "hi" ? "Reply in simple Hindi (Devanagari)." : "Reply in simple English.",
  ]
    .filter(Boolean)
    .join(" ");

  const res = await fetch(GATEWAY_CHAT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: args.prompt?.trim() || "Explain and solve the question in this image." },
            { type: "image_url", image_url: { url: args.imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is busy right now. Please retry in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Ask the admin to top up.");
    throw new Error(`Image doubt failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Guru.AI could not read that image. Try a clearer photo.");
  return { content, provider: VISION_MODEL };
}
