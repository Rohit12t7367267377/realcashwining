import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";

/**
 * Admin-only pre-generation for Exams, Library and College. Same rules as the school pre-generator:
 * finished work is read from the backend (no AI), each call stops after a small AI budget, and the
 * admin screen repeats the call until done=true.
 */
const BUDGET_MISSES = 2;
const BUDGET_MS = 20_000;
const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

async function lessonRunner() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { resolveTeachingContext, runTeachTurn } = await import("@/lib/guru-engine.server");
  return async (ctx: { scope: "exam" | "library" | "college" | "skill"; refId?: string | null; topic: string; subject?: string | null; levelLabel?: string | null; material?: string | null }, language: "en" | "hi" | undefined, mode: "easier" | "deeper") => {
    const resolved = await resolveTeachingContext(supabaseAdmin as never, SYSTEM_USER, ctx);
    if (language) resolved.language = language;
    await runTeachTurn({ ctx, resolved, mode, level: 3, studentText: null, history: [] });
  };
}

async function budget() {
  const { aiStats } = await import("@/lib/ai-gateway.server");
  const base = aiStats.misses; const started = Date.now();
  return () => aiStats.misses - base < BUDGET_MISSES && Date.now() - started < BUDGET_MS;
}

/** Lists the admin screen needs: exams, library size, college degrees. */
export const adminPregenOptions = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [exams, degrees, resources] = await Promise.all([
      supabaseAdmin.from("guru_exams").select("code, name").eq("active", true).order("sort_order"),
      supabaseAdmin.from("guru_college_degrees").select("id, name").eq("active", true).order("sort_order"),
      supabaseAdmin.from("guru_resources").select("id", { count: "exact", head: true }),
    ]);
    return { exams: exams.data ?? [], degrees: degrees.data ?? [], resources: resources.count ?? 0 };
  });

/** One level of the college tree for the admin pickers (regulation, term). */
export const adminCollegeLevel = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({
    level: z.enum(["regulations", "terms"]), degreeId: z.string().max(80), degree: z.string().max(80),
    regulationId: z.string().max(80).optional(), regulation: z.string().max(120).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { collegeCatalog } = await import("@/lib/guru-college-catalog.server");
    return collegeCatalog(supabaseAdmin, {
      level: data.level, degree: data.degree,
      parentId: data.level === "regulations" ? data.degreeId : data.regulationId, regulation: data.regulation,
    });
  });

export const adminPregenExam = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ code: z.string().trim().min(1).max(60), language: z.enum(["en", "hi"]).default("en"), withLessons: z.boolean().default(true) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildExamSyllabus, buildExamTopics } = await import("@/lib/guru-exams.server");
    const ok = await budget();
    const out = { subjects: 0, topics: 0, lessons: 0, done: false, error: null as string | null };
    try {
      const { data: exam } = await supabaseAdmin.from("guru_exams").select("id, name").eq("code", data.code).maybeSingle();
      if (!exam) throw new Error("Exam not found");
      let complete = true;
      await buildExamSyllabus(exam.name, data.language);
      const { data: subs } = await supabaseAdmin.from("guru_exam_subjects").select("id, name").eq("exam_id", exam.id).eq("active", true).order("sort_order");
      const run = data.withLessons ? await lessonRunner() : null;
      for (const sub of subs ?? []) {
        if (!ok()) { complete = false; break; }
        out.subjects += 1;
        const { data: dbTopics } = await supabaseAdmin.from("guru_exam_topics").select("title").eq("subject_id", sub.id).eq("active", true).order("sort_order");
        const topics = dbTopics?.length ? dbTopics.map((t) => t.title) : await buildExamTopics(exam.name, sub.name);
        out.topics += topics.length;
        // Same arguments the student screen sends: the subject itself, then each topic.
        for (const topic of [sub.name, ...topics]) {
          if (!run) break;
          for (const mode of ["easier", "deeper"] as const) {
            if (!ok()) { complete = false; break; }
            await run({ scope: "exam", topic, subject: sub.name, levelLabel: exam.name }, data.language, mode);
            out.lessons += 1;
          }
        }
      }
      out.done = complete;
    } catch (e) { out.error = e instanceof Error ? e.message : "Generation failed"; }
    return out;
  });

export const adminPregenLibrary = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ offset: z.number().int().min(0).default(0) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ok = await budget();
    const out = { next: data.offset, total: 0, lessons: 0, done: false, error: null as string | null };
    try {
      const { data: rows, count } = await supabaseAdmin.from("guru_resources")
        .select("id, title, topic, subject, class_name, language, access_type", { count: "exact" })
        .neq("access_type", "premium").order("created_at").range(data.offset, data.offset + 24);
      out.total = count ?? 0;
      const run = await lessonRunner();
      let i = 0;
      for (const r of rows ?? []) {
        if (!ok()) break;
        const lang = r.language === "hi" ? "hi" : "en";
        // The server overrides subject/level for library lessons, so the saved key matches what students get.
        const material = `Resource: ${r.title}. Explain in your own words; never reproduce long copyrighted passages.`;
        for (const mode of ["easier", "deeper"] as const) {
          await run({ scope: "library", refId: r.id, topic: r.topic || r.title, subject: r.subject, levelLabel: r.class_name, material }, lang, mode);
          out.lessons += 1;
        }
        i += 1;
      }
      out.next = data.offset + i;
      out.done = out.next >= out.total;
    } catch (e) { out.error = e instanceof Error ? e.message : "Generation failed"; }
    return out;
  });

export const adminPregenCollege = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({
    degree: z.string().trim().min(1).max(80),
    regulation: z.object({ id: z.string().max(80), name: z.string().max(120) }),
    term: z.object({ id: z.string().max(80), name: z.string().max(60) }),
    withQuiz: z.boolean().default(true),
  }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { collegeCatalog } = await import("@/lib/guru-college-catalog.server");
    const { buildClassNotes, buildTopicQuiz } = await import("@/lib/guru-notes.server");
    const ok = await budget();
    const out = { subjects: 0, topics: 0, notes: 0, quizzes: 0, done: false, error: null as string | null };
    try {
      const base = { degree: data.degree, regulation: data.regulation.name, term: data.term.name };
      const subjects = await collegeCatalog(supabaseAdmin, { level: "subjects", parentId: data.regulation.id, ...base });
      out.subjects = subjects.length;
      let complete = true;
      for (const subject of subjects) {
        const units = await collegeCatalog(supabaseAdmin, { level: "units", parentId: subject.id, subject: subject.name, ...base });
        for (const unit of units) {
          const topics = await collegeCatalog(supabaseAdmin, { level: "topics", parentId: unit.id, subject: subject.name, unit: unit.name, ...base });
          for (const topic of topics) {
            out.topics += 1;
            // Same scope the student screen builds.
            const scope = {
              board: data.regulation.name.slice(0, 60),
              className: data.term.name.replace(/semester\s*/i, "S").slice(0, 10),
              subject: subject.name.slice(0, 80), language: "en" as const, topic: topic.name,
            };
            if (!ok()) { complete = false; continue; }
            await buildClassNotes(scope); out.notes += 1;
            if (data.withQuiz) { if (!ok()) { complete = false; continue; } await buildTopicQuiz(scope); out.quizzes += 1; }
          }
        }
      }
      out.done = complete;
    } catch (e) { out.error = e instanceof Error ? e.message : "Generation failed"; }
    return out;
  });
