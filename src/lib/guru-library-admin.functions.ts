import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(240),
  author: z.string().trim().max(160).optional().or(z.literal("")),
  publisher: z.string().trim().max(160).optional().or(z.literal("")),
  isbn: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  cover_url: z.string().trim().max(600).optional().or(z.literal("")),
  language: z.string().trim().min(2).max(20).default("en"),
  resource_type: z.enum(["book", "notes", "reference", "study", "paper", "video", "link"]).default("book"),
  board: z.string().trim().max(80).optional().or(z.literal("")),
  class_name: z.string().trim().max(80).optional().or(z.literal("")),
  degree: z.string().trim().max(80).optional().or(z.literal("")),
  semester: z.string().trim().max(40).optional().or(z.literal("")),
  subject: z.string().trim().max(120).optional().or(z.literal("")),
  chapter: z.string().trim().max(160).optional().or(z.literal("")),
  topic: z.string().trim().max(160).optional().or(z.literal("")),
  exam: z.string().trim().max(80).optional().or(z.literal("")),
  source_name: z.string().trim().max(120).optional().or(z.literal("")),
  source_url: z.string().trim().max(600).optional().or(z.literal("")),
  license: z.string().trim().max(200).optional().or(z.literal("")),
  access_type: z.enum(["free", "signed_in", "premium"]).default("free"),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
  status: z.enum(["published", "draft", "archived"]).default("published"),
  active: z.boolean().default(true),
  content: z.string().max(200000).optional().or(z.literal("")),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

const clean = (v?: string) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

type Db = { from: (t: string) => any };

export type AdminResourceRow = {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  description: string | null;
  cover_url: string | null;
  language: string;
  resource_type: string;
  board: string | null;
  class_name: string | null;
  degree: string | null;
  semester: string | null;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  exam: string | null;
  source_name: string | null;
  source_url: string | null;
  license: string | null;
  access_type: string;
  tags: string[];
  status: string;
  active: boolean;
  content: string | null;
  chunk_count: number;
  indexed_at: string | null;
  sort_order: number;
};

/** Admin list with search + every filter. */
export const adminListResources = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        resource_type: z.string().trim().max(40).optional(),
        board: z.string().trim().max(80).optional(),
        class_name: z.string().trim().max(80).optional(),
        degree: z.string().trim().max(80).optional(),
        exam: z.string().trim().max(80).optional(),
        language: z.string().trim().max(20).optional(),
        status: z.string().trim().max(20).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    let q = db.from("guru_resources").select("*").order("sort_order").order("created_at", { ascending: false }).limit(300);
    for (const key of ["resource_type", "board", "class_name", "degree", "exam", "language", "status"] as const) {
      const val = data[key];
      if (val) q = q.eq(key, val);
    }
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ").trim();
      q = q.or(`title.ilike.%${s}%,author.ilike.%${s}%,publisher.ilike.%${s}%,isbn.ilike.%${s}%,subject.ilike.%${s}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as AdminResourceRow[];
  });

/** Create or update a resource. */
export const adminSaveResource = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => upsertSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const row = {
      title: data.title.trim(),
      author: clean(data.author),
      publisher: clean(data.publisher),
      isbn: clean(data.isbn),
      description: clean(data.description),
      cover_url: clean(data.cover_url),
      language: data.language,
      resource_type: data.resource_type,
      board: clean(data.board),
      class_name: clean(data.class_name),
      degree: clean(data.degree),
      semester: clean(data.semester),
      subject: clean(data.subject),
      chapter: clean(data.chapter),
      topic: clean(data.topic),
      exam: clean(data.exam),
      source_name: clean(data.source_name),
      source_url: clean(data.source_url),
      license: clean(data.license),
      access_type: data.access_type,
      tags: data.tags.filter(Boolean),
      status: data.status,
      active: data.active,
      content: clean(data.content),
      sort_order: data.sort_order,
    };
    if (data.id) {
      const { error } = await db.from("guru_resources").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, created: false };
    }
    const { data: created, error } = await db.from("guru_resources").insert(row).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { id: (created as { id: string } | null)?.id ?? "", created: true };
  });

/** Activate / deactivate without touching anything else. */
export const adminToggleResource = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const { error } = await db.from("guru_resources").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a resource (its indexed AI chunks are removed with it). */
export const adminDeleteResource = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const { error } = await db.from("guru_resources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * RAG pipeline: authorised resource text → chunking → embeddings → vector store,
 * so the AI teacher retrieves it before answering.
 */
export const adminIndexResource = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chunkText, embedTexts, GURU_EMBED_MODEL } = await import("@/lib/guru-rag.server");
    const db = supabaseAdmin as never as Db;

    const { data: res, error: readErr } = await db
      .from("guru_resources")
      .select("id, title, content, subject, class_name, board, language, license, access_type")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const resource = res as {
      id: string;
      title: string;
      content: string | null;
      subject: string | null;
      class_name: string | null;
      board: string | null;
      language: string;
      license: string | null;
    } | null;
    if (!resource) throw new Error("Resource not found");

    const text = (resource.content ?? "").trim();
    if (!text) {
      throw new Error(
        "Add the authorised text extract (or your own summary/notes) for this resource before indexing. Only licensed, public-domain or openly licensed material may be stored.",
      );
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("Nothing to index");

    await db.from("guru_ai_sources").delete().eq("resource_id", resource.id);

    let vectors: number[][] = [];
    try {
      // Embed in batches so long resources stay inside provider limits.
      for (let i = 0; i < chunks.length; i += 64) {
        vectors = vectors.concat(await embedTexts(chunks.slice(i, i + 64)));
      }
    } catch {
      vectors = [];
    }

    const rows = chunks.map((c, i) => ({
      scope: "library",
      kind: "resource",
      title: chunks.length > 1 ? `${resource.title} (part ${i + 1})` : resource.title,
      content: c,
      resource_id: resource.id,
      board: resource.board,
      class_name: resource.class_name,
      subject: resource.subject,
      language: resource.language ?? "en",
      embedding: vectors[i] ? JSON.stringify(vectors[i]) : null,
      model_version: vectors[i] ? GURU_EMBED_MODEL : null,
      metadata: { license: resource.license ?? null },
    }));

    const { error } = await db.from("guru_ai_sources").insert(rows);
    if (error) throw new Error(error.message);

    await db
      .from("guru_resources")
      .update({ chunk_count: rows.length, indexed_at: new Date().toISOString() })
      .eq("id", resource.id);

    return { chunks: rows.length, embedded: vectors.filter((v) => v.length > 0).length };
  });
