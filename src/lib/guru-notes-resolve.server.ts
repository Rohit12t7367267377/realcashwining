import { classNumber, seniorStudyOutline } from "./school-curriculum";
import { fallbackChapters } from "./school-syllabus-fallback";
import { suggestChapterList, suggestTopicList } from "@/lib/guru-notes.server";

export type NotesScope = { board: string; className: string; subject: string; language: "en" | "hi" };

/** Chapters a student sees for a board + class + subject: static outline, saved list, AI (then saved), or built-in fallback. */
export async function resolveChapters(data: NotesScope): Promise<string[]> {
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
}

export async function resolveTopics(data: NotesScope & { chapter: string }): Promise<string[]> {
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
}

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
