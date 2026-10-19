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

export async function callAiChat(messages: ChatMessage[], opts: AiChatOptions = {}): Promise<string> {
  const openai = opts.provider === "openai";
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
