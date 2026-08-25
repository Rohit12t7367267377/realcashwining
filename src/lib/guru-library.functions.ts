import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const RESOURCE_TYPES = [
  { value: "book", label: "Books", emoji: "📚" },
  { value: "notes", label: "Notes", emoji: "📝" },
  { value: "reference", label: "Reference Material", emoji: "📖" },
  { value: "study", label: "Study Resources", emoji: "🎯" },
  { value: "paper", label: "Question Papers", emoji: "🧾" },
  { value: "video", label: "Video / Lecture", emoji: "🎬" },
  { value: "link", label: "Web Resource", emoji: "🔗" },
] as const;

export const ACCESS_TYPES = ["free", "signed_in", "premium"] as const;
export const RESOURCE_STATUS = ["published", "draft", "archived"] as const;

const filterSchema = z.object({
  search: z.string().trim().max(120).optional(),
  resource_type: z.string().trim().max(40).optional(),
  board: z.string().trim().max(80).optional(),
  class_name: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(120).optional(),
  degree: z.string().trim().max(80).optional(),
  semester: z.string().trim().max(40).optional(),
  exam: z.string().trim().max(80).optional(),
  language: z.string().trim().max(20).optional(),
  topic: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(200).default(120),
});

export type LibraryResource = {
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
  chunk_count: number;
};

const COLUMNS =
  "id, title, author, publisher, isbn, description, cover_url, language, resource_type, board, class_name, degree, semester, subject, chapter, topic, exam, source_name, source_url, license, access_type, tags, chunk_count";

/** Library search: every legally available resource, filterable on every axis. */
export const guruListResources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => filterSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("guru_resources")
      .select(COLUMNS)
      .eq("active", true)
      .eq("status", "published")
      .order("sort_order")
      .order("title")
      .limit(data.limit);

    const eqFilters: Array<[string, string | undefined]> = [
      ["resource_type", data.resource_type],
      ["board", data.board],
      ["class_name", data.class_name],
      ["degree", data.degree],
      ["semester", data.semester],
      ["exam", data.exam],
      ["language", data.language],
    ];
    for (const [col, val] of eqFilters) if (val) q = q.eq(col, val);
    if (data.subject) q = q.ilike("subject", `%${data.subject}%`);
    if (data.topic) q = q.ilike("topic", `%${data.topic}%`);
    if (data.search) {
      const s = data.search.replace(/[%,]/g, " ").trim();
      q = q.or(
        [
          `title.ilike.%${s}%`,
          `author.ilike.%${s}%`,
          `publisher.ilike.%${s}%`,
          `description.ilike.%${s}%`,
          `subject.ilike.%${s}%`,
          `topic.ilike.%${s}%`,
        ].join(","),
      );
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as LibraryResource[];
  });

/** Distinct filter values so the Library filter bar is always in sync with the catalogue. */
export const guruResourceFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase
      .from("guru_resources")
      .select("board, class_name, subject, degree, semester, exam, language, resource_type")
      .eq("active", true)
      .eq("status", "published")
      .limit(500);

    const pick = (key: string) => {
      const set = new Set<string>();
      for (const r of (rows ?? []) as Array<Record<string, string | null>>) {
        const v = (r[key] ?? "").trim();
        if (v) set.add(v);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    };

    return {
      boards: pick("board"),
      classes: pick("class_name"),
      subjects: pick("subject"),
      degrees: pick("degree"),
      semesters: pick("semester"),
      exams: pick("exam"),
      languages: pick("language"),
      types: pick("resource_type"),
    };
  });

/** One resource plus how much of it is indexed for the AI teacher. */
export const guruResource = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("guru_resources")
      .select(`${COLUMNS}, content`)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Resource not found");
    const r = row as LibraryResource & { content: string | null };
    return {
      ...r,
      content: (r.content ?? "").slice(0, 20000),
      has_ai_context: (r.chunk_count ?? 0) > 0,
    };
  });

/** Ask the AI teacher about a library resource — answered from the indexed material (RAG). */
export const guruAskResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        resource_id: z.string().uuid(),
        question: z.string().trim().min(3).max(600),
        language: z.enum(["en", "hi"]).default("en"),
        intent: z.enum(["learn", "doubt", "simple", "practice", "revise"]).default("doubt"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: res } = await context.supabase
      .from("guru_resources")
      .select("title, author, publisher, subject, class_name, board, license, source_name, chunk_count")
      .eq("id", data.resource_id)
      .maybeSingle();
    if (!res) throw new Error("Resource not found");

    const { retrieveResourceContext, retrieveGuruContext, formatSources } = await import("@/lib/guru-rag.server");
    const { guruTeach } = await import("@/lib/guru.server");

    let passages = await retrieveResourceContext(context.supabase as never, {
      resourceId: data.resource_id,
      query: data.question,
    });
    if (passages.length === 0) {
      passages = await retrieveGuruContext(context.supabase as never, {
        query: `${res.title} ${data.question}`,
        scope: "library",
        limit: 4,
      });
    }

    const out = await guruTeach({
      intent: data.intent,
      question: data.question,
      language: data.language,
      character: null,
      topic: null,
      board: res.board ?? null,
      className: res.class_name ?? null,
      subject: res.subject ?? null,
      sources: formatSources(passages) || null,
      styleDirective: `You are teaching from the resource "${res.title}"${res.author ? ` by ${res.author}` : ""}${res.source_name ? ` (${res.source_name})` : ""}. Only reproduce short quotations; explain in your own words and never output long verbatim extracts.`,
      learnerContext: null,
    });

    return {
      answer: out.content,
      provider: out.provider,
      sources: passages.map((p) => ({ id: p.id, title: p.title })),
      grounded: passages.length > 0,
    };
  });
