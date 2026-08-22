import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";

/** Knowledge library stats for the admin panel. */
export const guruRagStats = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as {
      from: (t: string) => any;
    };
    const total = await db.from("guru_ai_sources").select("id", { count: "exact", head: true });
    const embedded = await db
      .from("guru_ai_sources")
      .select("id", { count: "exact", head: true })
      .not("embedding", "is", null);
    const lessons = await db.from("guru_lessons").select("id", { count: "exact", head: true }).eq("active", true);
    return {
      chunks: Number(total.count ?? 0),
      embedded: Number(embedded.count ?? 0),
      lessons: Number(lessons.count ?? 0),
    };
  });

/** Index (or re-index) active Guru.AI lessons into the RAG knowledge library. */
export const guruIndexLessons = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(50).default(10) }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { indexGuruSource } = await import("@/lib/guru-rag.server");
    const db = supabaseAdmin as never as { from: (t: string) => any };

    const { data: lessons, error } = await db
      .from("guru_lessons")
      .select("id, title, body, topic_id, guru_topics(title)")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    let documents = 0;
    let chunks = 0;
    const failures: string[] = [];
    for (const l of (lessons ?? []) as Array<{
      id: string;
      title: string | null;
      body: string | null;
      topic_id: string | null;
      guru_topics: { title?: string } | null;
    }>) {
      const body = (l.body ?? "").trim();
      if (!body) continue;
      try {
        chunks += await indexGuruSource({
          scope: "school",
          kind: "lesson",
          title: l.title || l.guru_topics?.title || "Lesson",
          content: body,
          topic_id: l.topic_id,
          lesson_id: l.id,
        });
        documents += 1;
      } catch (e) {
        failures.push(e instanceof Error ? e.message : "unknown error");
      }
    }
    return { documents, chunks, failures: failures.slice(0, 3) };
  });

/** Add a custom knowledge document (notes, syllabus, reference material). */
export const guruAddSource = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().trim().min(2).max(200),
        content: z.string().trim().min(20).max(60000),
        scope: z.enum(["school", "skills", "library", "galaxy", "universal"]).default("library"),
        subject: z.string().trim().max(100).optional(),
        class_name: z.string().trim().max(100).optional(),
        board: z.string().trim().max(100).optional(),
        language: z.enum(["en", "hi"]).default("en"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { indexGuruSource } = await import("@/lib/guru-rag.server");
    const chunks = await indexGuruSource({
      scope: data.scope,
      kind: "document",
      title: data.title,
      content: data.content,
      subject: data.subject ?? null,
      class_name: data.class_name ?? null,
      board: data.board ?? null,
      language: data.language,
    });
    return { chunks };
  });
