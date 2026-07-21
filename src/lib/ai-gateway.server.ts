// Server-only helper for calling the Lovable AI Gateway (chat completions).
// Reads LOVABLE_API_KEY from env inside every call site.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiChatOptions = {
  model?: string;
  temperature?: number;
  responseFormat?: "text" | "json_object";
};

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export async function callAiChat(messages: ChatMessage[], opts: AiChatOptions = {}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured (missing LOVABLE_API_KEY)");

  const body: Record<string, unknown> = {
    model: opts.model || DEFAULT_MODEL,
    messages,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (opts.responseFormat === "json_object") body.response_format = { type: "json_object" };

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is busy right now. Please retry in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Ask the admin to top up.");
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
