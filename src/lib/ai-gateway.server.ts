// Server-only helper for calling the Lovable AI Gateway (chat completions).
// Reads LOVABLE_API_KEY from env inside every call site.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiChatOptions = {
  model?: string;
  temperature?: number;
  responseFormat?: "text" | "json_object";
  /** Abort the request after this many ms so a stuck provider cannot hang a lesson. */
  timeoutMs?: number;
  /** "openai" sends the request to OpenAI (ChatGPT) with the server-side OPENAI_API_KEY; default is the Lovable gateway. */
  provider?: "lovable" | "openai";
};

const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_DEFAULT_MODEL = "gpt-4o-mini"; // override with the OPENAI_MODEL secret

/**
 * Which provider serves AI calls when the caller does not force one:
 * the owner's own OPENAI_API_KEY when it is set, otherwise the Lovable gateway.
 * Set AI_PROVIDER=lovable to keep using the gateway even when an OpenAI key exists.
 */
export function defaultAiProvider(): "lovable" | "openai" {
  if (process.env.AI_PROVIDER === "lovable") return "lovable";
  if (process.env.AI_PROVIDER === "openai" || process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY ? "openai" : "lovable";
  return "lovable";
}
export const hasAiKey = () => Boolean(process.env.OPENAI_API_KEY || process.env.LOVABLE_API_KEY);

export async function callAiChat(messages: ChatMessage[], opts: AiChatOptions = {}): Promise<string> {
  const openai = (opts.provider ?? defaultAiProvider()) === "openai";
  const key = openai ? process.env.OPENAI_API_KEY : process.env.LOVABLE_API_KEY;
  if (!key) throw new Error(openai ? "ChatGPT is not configured yet (missing OPENAI_API_KEY). Choose the default model in Classroom settings." : "AI is not configured (missing LOVABLE_API_KEY)");

  const body: Record<string, unknown> = {
    model: openai ? process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL : opts.model || DEFAULT_MODEL,
    messages,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (opts.responseFormat === "json_object") body.response_format = { type: "json_object" };

  const controller = opts.timeoutMs ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), opts.timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(openai ? OPENAI_URL : GATEWAY_URL, {
      method: "POST",
      headers: openai
        ? { "Content-Type": "application/json", Authorization: `Bearer ${key}` }
        : { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify(body),
      signal: controller?.signal,
    });
  } catch (err) {
    if (controller?.signal.aborted) throw new Error("The AI took too long to answer. Please retry.");
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is busy right now. Please retry in a moment.");
    if (res.status === 402 || (openai && res.status === 401)) throw new Error(openai ? "ChatGPT key was rejected or has no credit. Ask the admin to check OPENAI_API_KEY." : "AI credits exhausted. Ask the admin to top up.");
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned an empty response");
  return content;
}

export function extractJson(text: string): unknown {
  // Try direct parse first, then fenced code block, then first {...} / [...] block.
  const attempts: string[] = [text];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) attempts.push(fence[1]);
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) attempts.push(obj[0]);
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) attempts.push(arr[0]);
  for (const s of attempts) {
    try { return JSON.parse(s.trim()); } catch { /* keep trying */ }
  }
  throw new Error("AI did not return valid JSON");
}


async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Same as callAiChat, but identical requests are answered from the backend (table ai_content_cache)
 * so lessons, notes, quizzes and outlines are generated once and reused — saving AI credits.
 * Never use for personal doubts. If the table is missing the call simply runs uncached.
 */
export async function cachedChat(kind: string, messages: ChatMessage[], opts: AiChatOptions = {}): Promise<string> {
  let key = "";
  let db: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"] | null = null;
  try {
    key = await sha256(JSON.stringify([kind, messages, opts.responseFormat ?? "text"]));
    db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data } = await (db as any).from("ai_content_cache").select("response").eq("cache_key", key).maybeSingle(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const hit = (data as { response?: string } | null)?.response;
    if (hit) return hit;
  } catch { db = null; }
  const out = await callAiChat(messages, opts);
  if (db && key) {
    try {
      if (opts.responseFormat === "json_object") extractJson(out); // never cache a broken answer
      await (db as any).from("ai_content_cache").upsert({ cache_key: key, kind, response: out }, { onConflict: "cache_key" }); // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch { /* caching is optional */ }
  }
  return out;
}
