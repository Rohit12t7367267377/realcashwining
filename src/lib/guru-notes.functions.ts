import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classNumber, seniorStudyOutline } from "./school-curriculum";
import { fallbackChapters } from "./school-syllabus-fallback";
import {
  buildClassNotes,
  answerNotesDoubt,
  suggestChapterList,
  suggestTopicList,
  buildTopicQuiz,
} from "@/lib/guru-notes.server";

const scope = {
  board: z.string().trim().min(1).max(150),
  className: z.string().trim().min(1).max(10),
  subject: z.string().trim().min(1).max(80),
  language: z.enum(["en", "hi"]).default("en"),
};

/** Chapter/topic list for a board + class + subject (AI generated from the syllabus). */
export const listNotesChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object(scope).parse(d))
  .handler(async ({ data }) => {
    const grade = classNumber(data.className);
    const outline = /up.board|uttar pradesh|cbse|central board|bihar|bseb/i.test(data.board)
      ? seniorStudyOutline(grade, data.subject) : undefined;
    if (outline) return outline;
    const key = { kind: "chapters" as const, board: data.board, class_name: data.className, subject: data.subject, chapter: "", language: data.language };
    const cached = await readSyllabusCache(key);
    if (cached?.length) return cached;
    try {
      const list = await suggestChapterList(data);
      if (list.length) { await writeSyllabusCache(key, list); return list; }
    } catch (err) {
      const fb = fallbackChapters(grade, data.subject);
      if (fb) return fb;
      throw err;
    }
    return fallbackChapters(grade, data.subject) ?? [];
  });

/** Topics inside one chapter. */
export const listNotesTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...scope, chapter: z.string().trim().min(2).max(160) }).parse(d))
  .handler(async ({ data }) => {
    const key = { kind: "topics" as const, board: data.board, class_name: data.className, subject: data.subject, chapter: data.chapter, language: data.language };
    const cached = await readSyllabusCache(key);
    if (cached?.length) return cached;
    try {
      const list = await suggestTopicList(data);
      if (list.length > 1) await writeSyllabusCache(key, list);
      return list;
    } catch {
      return [data.chapter];
    }
  });

/** Full teacher-style notes for one topic. */
export const getClassNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...scope, topic: z.string().trim().min(2).max(160) }).parse(d))
  .handler(async ({ data }) => buildClassNotes(data));

/** 5-question MCQ quiz for the topic. */
export const getTopicQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...scope, topic: z.string().trim().min(2).max(160) }).parse(d))
  .handler(async ({ data }) => buildTopicQuiz(data));

/** Ask a doubt about the current notes topic; answered like a patient teacher. */
export const askNotesDoubt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ...scope,
        topic: z.string().trim().min(2).max(160),
        question: z.string().trim().min(2).max(600),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
          .max(12)
          .default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => answerNotesDoubt(data));

type CacheKey = { kind: "chapters" | "topics"; board: string; class_name: string; subject: string; chapter: string; language: string };

/** Cache reads/writes never break the lesson: if the table is missing they are skipped. */
async function readSyllabusCache(key: CacheKey): Promise<string[] | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("school_syllabus_cache" as never).select("items").match(key as never).maybeSingle();
    const items = (data as { items?: unknown } | null)?.items;
    return Array.isArray(items) ? items.filter((x): x is string => typeof x === "string") : null;
  } catch { return null; }
}

async function writeSyllabusCache(key: CacheKey, items: string[]) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("school_syllabus_cache" as never).upsert({ ...key, items } as never, { onConflict: "kind,board,class_name,subject,chapter,language" });
  } catch { /* cache is optional */ }
}
