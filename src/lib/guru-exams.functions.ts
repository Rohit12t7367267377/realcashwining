import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildExamQuestions, buildExamSyllabus, buildExamTopics, buildStudyPlan } from "@/lib/guru-exams.server";

export type ExamCard = {
  id: string;
  code: string;
  name: string;
  category: string;
  emoji: string;
  blurb: string;
  body: string;
  subjects: number;
};

/** All exams the admin has published, grouped by category on the client. */
export const listGuruExams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExamCard[]> => {
    const { supabase } = context;
    const { data: exams } = await supabase
      .from("guru_exams")
      .select("id, code, name, category, emoji, blurb, conducting_body, sort_order")
      .eq("active", true)
      .order("sort_order");
    const ids = (exams ?? []).map((e) => e.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: subs } = await supabase
        .from("guru_exam_subjects")
        .select("id, exam_id")
        .in("exam_id", ids)
        .eq("active", true);
      for (const s of subs ?? []) counts.set(s.exam_id, (counts.get(s.exam_id) ?? 0) + 1);
    }
    return (exams ?? []).map((e) => ({
      id: e.id,
      code: e.code,
      name: e.name,
      category: e.category,
      emoji: e.emoji,
      blurb: e.blurb,
      body: e.conducting_body,
      subjects: counts.get(e.id) ?? 0,
    }));
  });

/** One exam with its subjects, admin-added topics and the learner's attempt history. */
export const getGuruExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: exam } = await supabase
      .from("guru_exams")
      .select("id, code, name, category, emoji, blurb, conducting_body")
      .eq("code", data.code)
      .maybeSingle();
    if (!exam) throw new Error("Exam not found");

    const { data: subjects } = await supabase
      .from("guru_exam_subjects")
      .select("id, name, emoji, weightage, sort_order")
      .eq("exam_id", exam.id)
      .eq("active", true)
      .order("sort_order");

    const subjectIds = (subjects ?? []).map((s) => s.id);
    const topicsBySubject = new Map<string, string[]>();
    if (subjectIds.length) {
      const { data: topics } = await supabase
        .from("guru_exam_topics")
        .select("subject_id, title, sort_order")
        .in("subject_id", subjectIds)
        .eq("active", true)
        .order("sort_order");
      for (const t of topics ?? []) {
        const list = topicsBySubject.get(t.subject_id) ?? [];
        list.push(t.title);
        topicsBySubject.set(t.subject_id, list);
      }
    }

    const { data: attempts } = await supabase
      .from("guru_exam_attempts")
      .select("subject, topic, mode, correct, total, created_at")
      .eq("user_id", userId)
      .eq("exam_code", exam.code)
      .order("created_at", { ascending: false })
      .limit(60);

    return {
      exam,
      subjects: (subjects ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        weightage: s.weightage,
        topics: topicsBySubject.get(s.id) ?? [],
      })),
      attempts: attempts ?? [],
    };
  });

/** Syllabus + paper pattern (AI, grounded in the published syllabus). */
export const getExamSyllabus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ exam: z.string().trim().min(2).max(80), language: z.enum(["en", "hi"]).default("en") }).parse(d),
  )
  .handler(async ({ data }) => buildExamSyllabus(data.exam, data.language));

/** Topic list for a subject when the admin has not added topics yet. */
export const getExamTopics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ exam: z.string().trim().min(2).max(80), subject: z.string().trim().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data }) => buildExamTopics(data.exam, data.subject));

/** Practice / quiz / mock / PYQ-style question sets. */
export const getExamQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        exam: z.string().trim().min(2).max(80),
        subject: z.string().trim().min(1).max(80),
        topic: z.string().trim().max(160).optional(),
        mode: z.enum(["practice", "quiz", "mock", "pyq"]),
        count: z.number().int().min(3).max(25).default(5),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        language: z.enum(["en", "hi"]).default("en"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => buildExamQuestions(data));

/** Save an attempt so performance analysis and weak topics stay accurate. */
export const saveExamAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        exam_code: z.string().trim().min(1).max(60),
        subject: z.string().trim().max(80).default(""),
        topic: z.string().trim().max(160).default(""),
        mode: z.enum(["practice", "quiz", "mock", "pyq"]),
        correct: z.number().int().min(0).max(500),
        total: z.number().int().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("guru_exam_attempts").insert({ ...data, user_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Weak-topic aware study plan. */
export const getExamStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        exam: z.string().trim().min(2).max(80),
        weeks: z.number().int().min(1).max(24).default(8),
        hoursPerDay: z.number().int().min(1).max(14).default(4),
        weakTopics: z.array(z.string().max(160)).max(12).default([]),
        language: z.enum(["en", "hi"]).default("en"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => buildStudyPlan(data));
