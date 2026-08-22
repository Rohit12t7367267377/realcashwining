// Server-only RAG helpers for Guru.AI: embed text, index curriculum into
// public.guru_ai_sources, and retrieve relevant passages for AI answers.

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
export const GURU_EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims — matches the column

export type GuruSourcePassage = {
  id: string;
  title: string;
  content: string;
  scope: string;
  kind: string;
  similarity: number;
};

type MinimalClient = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/** Split long text into overlapping chunks so retrieval stays focused. */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = (text ?? "").replace(/\r/g, "").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size);
    if (end < clean.length) {
      const brk = clean.lastIndexOf("\n", end);
      const dot = clean.lastIndexOf(". ", end);
      const cut = Math.max(brk, dot);
      if (cut > start + size * 0.5) end = cut + 1;
    }
    out.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(0, end - overlap);
  }
  return out.filter(Boolean);
}

/** Embed one or more strings. Returns [] when AI is not configured. */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key || inputs.length === 0) return [];
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model: GURU_EMBED_MODEL, input: inputs }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("AI is busy right now. Please retry in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Ask the admin to top up.");
    throw new Error(`Embedding request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data?: Array<{ index?: number; embedding?: number[] }> };
  const rows = (data.data ?? []).slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return rows.map((r) => r.embedding ?? []).filter((v) => v.length > 0);
}

export async function embedText(input: string): Promise<number[] | null> {
  const [v] = await embedTexts([input]);
  return v ?? null;
}

/**
 * Retrieve the most relevant knowledge passages for a question.
 * Vector search first; keyword search as a fallback (and when AI is unavailable).
 */
export async function retrieveGuruContext(
  supabase: MinimalClient,
  args: { query: string; topicId?: string | null; scope?: string | null; limit?: number },
): Promise<GuruSourcePassage[]> {
  const limit = args.limit ?? 5;
  const rpcArgs = {
    match_count: limit,
    _topic_id: args.topicId ?? null,
    _scope: args.scope ?? null,
  };

  try {
    const vec = await embedText(args.query);
    if (vec) {
      const { data, error } = await supabase.rpc("match_guru_sources", {
        ...rpcArgs,
        query_embedding: JSON.stringify(vec),
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        return (data as GuruSourcePassage[]).filter((p) => (p.similarity ?? 0) > 0.15).slice(0, limit);
      }
    }
  } catch {
    /* fall through to keyword search */
  }

  try {
    const { data } = await supabase.rpc("search_guru_sources", { ...rpcArgs, _query: args.query });
    if (Array.isArray(data)) return (data as GuruSourcePassage[]).slice(0, limit);
  } catch {
    /* no retrieval available */
  }
  return [];
}

/** Format retrieved passages for the AI system prompt. */
export function formatSources(passages: GuruSourcePassage[]): string {
  if (passages.length === 0) return "";
  return passages
    .map((p, i) => `[[Source ${i + 1}: ${p.title}]]\n${(p.content ?? "").slice(0, 2500)}`)
    .join("\n\n");
}

export type IndexSourceInput = {
  scope?: string;
  kind?: string;
  title: string;
  content: string;
  topic_id?: string | null;
  lesson_id?: string | null;
  board?: string | null;
  class_name?: string | null;
  subject?: string | null;
  language?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Chunk + embed + upsert a document into guru_ai_sources using the admin client.
 * Existing rows for the same lesson/topic+title are replaced so re-indexing is idempotent.
 */
export async function indexGuruSource(input: IndexSourceInput): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const chunks = chunkText(input.content);
  if (chunks.length === 0) return 0;

  const del = supabaseAdmin.from("guru_ai_sources" as never).delete();
  if (input.lesson_id) await del.eq("lesson_id", input.lesson_id);
  else if (input.topic_id) await del.eq("title", input.title).eq("topic_id", input.topic_id);
  else await del.eq("title", input.title).is("topic_id", null);


  let vectors: number[][] = [];
  try {
    vectors = await embedTexts(chunks);
  } catch {
    vectors = [];
  }

  const rows = chunks.map((c, i) => ({
    scope: input.scope ?? "school",
    kind: input.kind ?? "lesson",
    title: chunks.length > 1 ? `${input.title} (part ${i + 1})` : input.title,
    content: c,
    topic_id: input.topic_id ?? null,
    lesson_id: input.lesson_id ?? null,
    board: input.board ?? null,
    class_name: input.class_name ?? null,
    subject: input.subject ?? null,
    language: input.language ?? "en",
    embedding: vectors[i] ? JSON.stringify(vectors[i]) : null,
    model_version: vectors[i] ? GURU_EMBED_MODEL : null,
    metadata: input.metadata ?? {},
  }));

  const { error } = await supabaseAdmin.from("guru_ai_sources" as never).insert(rows as never);
  if (error) throw new Error(error.message);
  return rows.length;
}
