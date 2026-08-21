import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";

/** Sports config for the admin panel. The API key is never returned. */
export const getSportsConfig = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { readSportsConfig } = await import("@/lib/sports.server");
    const cfg = await readSportsConfig();
    const { apiKey: _omit, ...safe } = cfg;
    return safe;
  });

export const saveSportsConfig = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        enabled: z.boolean(),
        refreshSeconds: z.number().int().min(30).max(3600),
        autoQuiz: z.boolean(),
        autoResult: z.boolean(),
        autoReading: z.boolean(),
        questionsPerMatch: z.number().int().min(1).max(25),
        requireReview: z.boolean(),
        apiKey: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const rows: { key: string; value: boolean | number | string; updated_at: string }[] = [
      { key: "cricket_enabled", value: data.enabled, updated_at: now },
      { key: "cricket_refresh_seconds", value: data.refreshSeconds, updated_at: now },
      { key: "sports_auto_quiz", value: data.autoQuiz, updated_at: now },
      { key: "sports_auto_result", value: data.autoResult, updated_at: now },
      { key: "sports_auto_reading", value: data.autoReading, updated_at: now },
      { key: "sports_questions_per_match", value: data.questionsPerMatch, updated_at: now },
      { key: "sports_require_review", value: data.requireReview, updated_at: now },
    ];
    if (data.apiKey && data.apiKey.trim().length > 0) {
      const { sanitizeApiKey } = await import("@/lib/sports.server");
      const key = sanitizeApiKey(data.apiKey);
      if (!key) throw new Error("That API key looks empty — paste only the key itself.");
      rows.push({ key: "cricket_api_key", value: key, updated_at: now });
    }

    const { error } = await supabaseAdmin.from("app_settings").upsert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const refreshSportsFeed = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { refreshSportsMatches } = await import("@/lib/sports.server");
    return await refreshSportsMatches();
  });

export const listSportsMatchesAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("cricket_matches")
      .select("id, name, series, status, venue, team_a, team_b, score_a, score_b, match_type, is_live, date_time")
      .order("is_live", { ascending: false })
      .order("date_time", { ascending: false })
      .limit(40);
    return data ?? [];
  });

/** Contests linked to a live match, with their per-contest automation flags. */
export const listMatchContests = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("contests")
      .select("id, title, match_id, auto_quiz, auto_result, review_required, results_status, starts_at, ends_at, category_id, active")
      .order("created_at", { ascending: false })
      .limit(80);
    return data ?? [];
  });

export const linkContestToMatch = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        contest_id: z.string().uuid(),
        match_id: z.string().uuid().nullable(),
        auto_quiz: z.boolean(),
        auto_result: z.boolean(),
        review_required: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("contests")
      .update({
        match_id: data.match_id,
        auto_quiz: data.auto_quiz,
        auto_result: data.auto_result,
        review_required: data.review_required,
      })
      .eq("id", data.contest_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateMatchDrafts = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        match_id: z.string().uuid(),
        count: z.number().int().min(1).max(25),
        contest_id: z.string().uuid().nullable().optional(),
        category_id: z.string().uuid().nullable().optional(),
        difficulty: z.enum(["easy", "medium", "hard", "mixed"]).default("mixed"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { generateMatchQuestionDrafts } = await import("@/lib/sports.server");
    return await generateMatchQuestionDrafts({
      matchId: data.match_id,
      count: data.count,
      contestId: data.contest_id ?? null,
      categoryId: data.category_id ?? null,
      difficulty: data.difficulty,
    });
  });

export const generateMatchReading = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        match_id: z.string().uuid(),
        category_id: z.string().uuid().nullable().optional(),
        num_questions: z.number().int().min(2).max(15).default(5),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { generateMatchReadingPassage } = await import("@/lib/sports.server");
    return await generateMatchReadingPassage({
      matchId: data.match_id,
      categoryId: data.category_id ?? null,
      numQuestions: data.num_questions,
    });
  });

export const listQuizDrafts = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ status: z.enum(["pending", "approved", "rejected"]).default("pending") }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("sports_quiz_drafts")
      .select("*")
      .eq("status", data.status)
      .order("created_at", { ascending: false })
      .limit(200);
    return rows ?? [];
  });

export const updateQuizDraft = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        question: z.string().trim().min(4).max(500),
        options: z.array(z.string().trim().min(1).max(200)).length(4),
        correct_index: z.number().int().min(0).max(3),
        explanation: z.string().max(500).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sports_quiz_drafts")
      .update({
        question: data.question,
        options: data.options,
        correct_index: data.correct_index,
        explanation: data.explanation ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rejectQuizDrafts = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sports_quiz_drafts")
      .update({ status: "rejected" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin approval is the ONLY path from draft to a live quiz question. */
export const approveQuizDrafts = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(100), category_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: drafts, error } = await supabaseAdmin
      .from("sports_quiz_drafts")
      .select("*")
      .in("id", data.ids)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    let published = 0;
    for (const d of drafts ?? []) {
      const { data: q, error: qErr } = await supabaseAdmin
        .from("questions")
        .insert({
          category_id: data.category_id,
          question: d.question,
          options: d.options,
          correct_index: d.correct_index,
          explanation: d.explanation,
          difficulty: d.difficulty ?? "medium",
        })
        .select("id")
        .single();
      if (qErr) continue;
      await supabaseAdmin
        .from("sports_quiz_drafts")
        .update({ status: "approved", published_question_id: q.id, category_id: data.category_id })
        .eq("id", d.id);
      published++;
    }
    return { published };
  });

/** Manual override for the whole sports automation pass. */
export const runSportsAutomationNow = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { runSportsAutomation } = await import("@/lib/sports.server");
    return await runSportsAutomation();
  });

/** Create a sports contest already linked to a live match, and draft its questions. */
export const createContestFromMatch = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        match_id: z.string().uuid(),
        category_id: z.string().uuid(),
        entry_fee: z.number().min(0).max(10000).default(0),
        prize_pool: z.number().min(0).max(1000000).default(0),
        num_questions: z.number().int().min(1).max(25).default(5),
        duration_minutes: z.number().int().min(1).max(180).default(10),
        auto_quiz: z.boolean().default(true),
        auto_result: z.boolean().default(true),
        draft_now: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: match, error: mErr } = await supabaseAdmin
      .from("cricket_matches")
      .select("id, name, date_time")
      .eq("id", data.match_id)
      .single();
    if (mErr || !match) throw new Error("Match not found — refresh the live feed first.");

    const start = new Date();
    const end = new Date(start.getTime() + data.duration_minutes * 60000 + 6 * 3600000);

    const { data: contest, error } = await supabaseAdmin
      .from("contests")
      .insert({
        title: `${match.name} — Live Quiz`,
        category_id: data.category_id,
        match_id: data.match_id,
        entry_fee: data.entry_fee,
        prize_pool: data.prize_pool,
        first_prize: Math.round(data.prize_pool * 0.5),
        num_questions: data.num_questions,
        duration_minutes: data.duration_minutes,
        contest_type: data.entry_fee > 0 ? "paid" : "free",
        active: true,
        max_participants: 10000,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        auto_quiz: data.auto_quiz,
        auto_result: data.auto_result,
        review_required: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    let drafted = 0;
    if (data.draft_now) {
      const { generateMatchQuestionDrafts } = await import("@/lib/sports.server");
      const r = await generateMatchQuestionDrafts({
        matchId: data.match_id,
        count: data.num_questions,
        contestId: contest.id,
        categoryId: data.category_id,
        difficulty: "mixed",
      });
      drafted = r.drafted;
    }
    return { contest_id: contest.id, drafted };
  });
