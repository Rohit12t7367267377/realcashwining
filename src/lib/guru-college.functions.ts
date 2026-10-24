import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildCodingQuestions,
  buildOutputPredictions,
  reviewCode,
  suggestCollegeList,
} from "@/lib/guru-college.server";

export type CollegeItem = { id: string; name: string; emoji: string; fromDb: boolean; programming?: boolean };

const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);
const PROG_HINT = /(program|coding|c\+\+|\bc\b|java|python|javascript|data structure|dsa|algorithm|software|web|oop|dbms|sql|compiler|operating system|machine learning|ai\b)/i;

/** Degrees the admin has published. */
export const listCollegeDegrees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("guru_college_degrees")
      .select("id, code, name, level, emoji, blurb, sort_order")
      .eq("active", true)
      .order("sort_order");
    return data ?? [];
  });

/**
 * One level of the College hierarchy: whatever the admin added to the database
 * is served first, and AI fills the gap so the flow never dead-ends.
 */
export const getCollegeCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        level: z.enum(["regulations", "terms", "subjects", "units", "topics"]),
        parentId: z.string().max(80).optional(),
        degree: z.string().trim().min(1).max(80),
        regulation: z.string().trim().max(120).optional(),
        term: z.string().trim().max(60).optional(),
        subject: z.string().trim().max(120).optional(),
        unit: z.string().trim().max(160).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<CollegeItem[]> => (await import("@/lib/guru-college-catalog.server")).collegeCatalog(context.supabase, data));

/** Coding practice problems for a programming topic. */
export const getCodingQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().trim().min(1).max(120),
        topic: z.string().trim().min(1).max(160),
        language: z.string().trim().min(1).max(30).default("Python"),
        count: z.number().int().min(1).max(6).default(3),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { enforceFeature } = await import("@/lib/monetization.server");
    await enforceFeature(context.userId, "college_ai");
    return buildCodingQuestions(data);
  });

/** Predict-the-output MCQs. */
export const getOutputPredictions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().trim().min(1).max(120),
        topic: z.string().trim().min(1).max(160),
        language: z.string().trim().min(1).max(30).default("Python"),
        count: z.number().int().min(1).max(6).default(3),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { enforceFeature } = await import("@/lib/monetization.server");
    await enforceFeature(context.userId, "college_ai");
    return buildOutputPredictions(data);
  });

/** Explain, debug or review the code written in the editor. */
export const runCodeReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        mode: z.enum(["explain", "debug", "review"]),
        language: z.string().trim().min(1).max(30).default("Python"),
        code: z.string().trim().min(1).max(8000),
        problem: z.string().trim().max(1200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { enforceFeature } = await import("@/lib/monetization.server");
    await enforceFeature(context.userId, "college_ai");
    return reviewCode(data);
  });

/** Read + write learner progress for College and Exam topics. */
export const saveLearnProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        track: z.enum(["college", "exam"]),
        node_key: z.string().trim().min(1).max(300),
        status: z.enum(["opened", "practised", "quizzed", "revised", "mastered"]).default("opened"),
        score: z.number().int().min(0).max(100).nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("guru_learn_progress").upsert(
      {
        user_id: userId,
        track: data.track,
        node_key: data.node_key,
        status: data.status,
        score: data.score,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,track,node_key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getLearnProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ track: z.enum(["college", "exam"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("guru_learn_progress")
      .select("node_key, status, score, updated_at")
      .eq("user_id", userId)
      .eq("track", data.track)
      .order("updated_at", { ascending: false })
      .limit(200);
    return rows ?? [];
  });
