// Admin control center for the free-to-play prediction engine.
// Every operation is authorised on the server (settings.manage) and the engine's
// own rules (state machine, correction log, audit trail) cannot be bypassed here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PERM = "settings.manage";
const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const id = z.string().uuid();
const timingSchema = z.object({
  trigger: z.enum(["pre_match", "innings_break", "after_over", "match_completed"]),
  createBeforeMin: z.number().int().min(0).max(10080),
  opensBeforeMin: z.number().int().min(0).max(10080),
  locksBeforeMin: z.number().int().min(0).max(10080),
  lockAfterMin: z.number().int().min(0).max(10080),
  catchUp: z.enum(["skip", "shorten"]),
  minOpenMin: z.number().int().min(0).max(10080),
  afterOver: z.number().int().min(1).max(50).optional(),
  innings: z.number().int().min(1).max(4).optional(),
});
const planSchema = z.object({
  generator: z.enum(["match_winner", "over_by_over", "innings_total", "static"]),
  innings: z.number().int().min(1).max(4).optional(),
  over: z.number().int().min(1).max(50).optional(),
  balls: z.number().int().min(1).max(6).optional(),
  thresholds: z.array(z.number().int().min(0).max(1000)).min(1).max(7).optional(),
  questions: z.array(z.object({
    prompt: z.string().trim().min(3).max(300),
    options: z.array(z.string().trim().min(1).max(120)).min(2).max(8),
    correctIndex: z.number().int().min(0).max(7),
  })).max(50).optional(),
  points: z.number().int().min(1).max(1000).optional(),
});
const scoringSchema = z.object({
  pointsPerCorrect: z.number().int().min(1).max(1000),
  negativePerWrong: z.number().int().min(0).max(1000),
});

async function engine(refreshSeconds = 60) {
  const { SupabasePredStore } = await import("@/lib/pred/supabase-store.server");
  return new SupabasePredStore({ refreshSeconds });
}

export const getPredAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminPermission(PERM)])
  .handler(async () => {
    const [sports, categories, templates, contests, jobs, settings, corrections] = await Promise.all([
      db.from("pred_sports").select("*").order("sort_order"),
      db.from("pred_categories").select("*").order("sort_order"),
      db.from("pred_templates").select("*").order("created_at"),
      db.from("pred_contests").select("id, title, status, sport, trigger, opens_at, locks_at, match_id, template_id, generation_key, cancel_reason, correction_version, participant_limit").order("created_at", { ascending: false }).limit(80),
      db.from("pred_jobs").select("*").order("started_at", { ascending: false }).limit(30),
      db.from("app_settings").select("key, value").in("key", ["pred_engine_enabled", "pred_bbb_enabled", "pred_reward_rules", "sports_sync_health"]),
      db.from("pred_corrections").select("id, question_id, contest_id, before_state, after_state, actor, reason, created_at").order("created_at", { ascending: false }).limit(30),
    ]);
    for (const r of [sports, categories, templates, contests, jobs, settings, corrections]) if (r.error) throw new Error(r.error.message);
    const s = new Map<string, unknown>((settings.data as any[]).map((r) => [r.key, r.value]));
    const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const failed24h = (jobs.data as any[]).filter((j) => j.status === "failed" && j.started_at >= since).length;
    return {
      sports: sports.data, categories: categories.data, templates: templates.data, contests: contests.data,
      jobs: jobs.data, corrections: corrections.data, failedJobs24h: failed24h,
      settings: {
        engineEnabled: s.get("pred_engine_enabled") !== false,
        bbbEnabled: s.get("pred_bbb_enabled") === true,
        rewards: s.get("pred_reward_rules") ?? null,
      },
      providerHealth: s.get("sports_sync_health") ?? null,
    };
  });

export const savePredSettings = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({
    engineEnabled: z.boolean(),
    bbbEnabled: z.boolean(),
    rewards: z.object({
      participation: z.number().int().min(0).max(1000),
      perCorrect: z.number().int().min(0).max(1000),
      rankBonus: z.array(z.number().int().min(0).max(10000)).max(20),
      maxPerContest: z.number().int().min(0).max(100000),
      dailyCap: z.number().int().min(0).max(1000000),
    }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const now = new Date().toISOString();
    const { error } = await db.from("app_settings").upsert([
      { key: "pred_engine_enabled", value: data.engineEnabled, updated_at: now },
      { key: "pred_bbb_enabled", value: data.bbbEnabled, updated_at: now },
      { key: "pred_reward_rules", value: data.rewards, updated_at: now },
    ]);
    if (error) throw new Error(error.message);
    await (await engine()).audit("settings.saved", context.adminUserId, "pred_settings", { engineEnabled: data.engineEnabled, bbbEnabled: data.bbbEnabled });
    return { ok: true };
  });

export const setPredSportEnabled = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({ key: z.string().min(1).max(40), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await db.from("pred_sports").update({ enabled: data.enabled }).eq("key", data.key);
    if (error) throw new Error(error.message);
    await (await engine()).audit("sport.toggled", context.adminUserId, data.key, { enabled: data.enabled });
    return { ok: true };
  });

export const upsertPredCategory = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({
    id: id.optional(),
    key: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, "Use lowercase letters, numbers and _"),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(300).optional().nullable(),
    sport: z.string().trim().min(2).max(40),
    enabled: z.boolean(),
    sortOrder: z.number().int().min(0).max(1000).default(100),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row = { key: data.key, name: data.name, description: data.description ?? null, sport: data.sport, enabled: data.enabled, sort_order: data.sortOrder };
    const q = data.id ? db.from("pred_categories").update(row).eq("id", data.id) : db.from("pred_categories").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await (await engine()).audit("category.saved", context.adminUserId, data.key, { enabled: data.enabled });
    return { ok: true };
  });

export const upsertPredTemplate = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({
    id: id.optional(),
    categoryId: id.nullable().optional(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(300).optional().nullable(),
    sport: z.string().trim().min(2).max(40),
    formats: z.array(z.string().trim().min(1).max(20)).max(10).default([]),
    plan: planSchema,
    timing: timingSchema,
    scoring: scoringSchema,
    participantLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    autoGenerate: z.boolean(),
    requireApproval: z.boolean(),
    allowEdit: z.boolean(),
    enabled: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { validateTiming } = await import("@/lib/pred/timing");
    const { generateForTemplate } = await import("@/lib/pred/generate");
    const timingError = validateTiming(data.timing);
    if (timingError) throw new Error(timingError);
    // Dry-run the generator so an invalid plan is rejected now, not at 3am.
    const probe = generateForTemplate(
      { id: "probe", sport: data.sport, format: data.formats[0] ?? "t20", startsAt: null, state: "upcoming", teamA: "Team A", teamB: "Team B", statusText: "" },
      { ...data, id: "probe", categoryId: data.categoryId ?? null, participantLimit: data.participantLimit ?? null },
    );
    if (!probe.ok && !["format_not_supported", "needs_ball_data", "over_out_of_range"].includes(probe.reason)) throw new Error(`Plan is invalid: ${probe.reason}`);
    const row = {
      category_id: data.categoryId ?? null, name: data.name, description: data.description ?? null, sport: data.sport, formats: data.formats,
      plan: data.plan, timing: data.timing, scoring: data.scoring, participant_limit: data.participantLimit ?? null,
      auto_generate: data.autoGenerate, require_approval: data.requireApproval, allow_edit: data.allowEdit, enabled: data.enabled,
      updated_at: new Date().toISOString(),
    };
    const q = data.id ? db.from("pred_templates").update(row).eq("id", data.id) : db.from("pred_templates").insert({ ...row, created_by: context.adminUserId });
    const { error } = await q;
    if (error) throw new Error(error.message);
    await (await engine()).audit("template.saved", context.adminUserId, data.id ?? data.name, { enabled: data.enabled, autoGenerate: data.autoGenerate });
    return { ok: true };
  });

export const deletePredTemplate = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    // Existing contests keep their data (template_id is ON DELETE SET NULL).
    const { error } = await db.from("pred_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await (await engine()).audit("template.deleted", context.adminUserId, data.id, {});
    return { ok: true };
  });

export const approvePredContest = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data, context }) => {
    const { approveContest } = await import("@/lib/pred/engine");
    const ok = await approveContest(await engine(), data.id, context.adminUserId);
    if (!ok) throw new Error("Only draft contests can be approved.");
    return { ok: true };
  });

export const cancelPredContest = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({ id, reason: z.string().trim().min(5).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { cancelContest } = await import("@/lib/pred/engine");
    const ok = await cancelContest(await engine(), data.id, context.adminUserId, data.reason);
    if (!ok) throw new Error("Only draft, scheduled or published contests can be cancelled.");
    return { ok: true };
  });

/** Visual custom-contest builder: static (trivia) or manually-settled questions. */
export const createCustomPredContest = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({
    title: z.string().trim().min(3).max(120),
    sport: z.string().trim().min(2).max(40).default("general"),
    categoryId: id.nullable().optional(),
    matchId: id.nullable().optional(),
    opensAt: z.string().datetime(),
    locksAt: z.string().datetime(),
    participantLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    allowEdit: z.boolean().default(false),
    scoring: scoringSchema,
    publish: z.boolean().default(false), // false => draft awaiting approval
    questions: z.array(z.object({
      prompt: z.string().trim().min(3).max(300),
      options: z.array(z.string().trim().min(1).max(120)).min(2).max(8),
      /** index of the correct option for trivia; omit to settle manually after the lock */
      correctIndex: z.number().int().min(0).max(7).nullable().optional(),
      points: z.number().int().min(1).max(1000).default(10),
    })).min(1).max(50),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { validateQuestions } = await import("@/lib/pred/generate");
    if (Date.parse(data.locksAt) <= Date.parse(data.opensAt)) throw new Error("Questions must lock after registration opens.");
    if (Date.parse(data.locksAt) <= Date.now()) throw new Error("The lock time is already in the past.");
    const questions = data.questions.map((q, i) => {
      const options = q.options.map((label, k) => ({ id: `o${k + 1}`, label }));
      if (q.correctIndex != null && q.correctIndex >= options.length) throw new Error(`Question ${i + 1}: correct answer is out of range.`);
      return {
        position: i + 1, prompt: q.prompt, options, points: q.points,
        rule: q.correctIndex != null ? ({ kind: "static" } as const) : ({ kind: "manual" } as const),
        staticCorrect: q.correctIndex != null ? options[q.correctIndex].id : undefined,
      };
    });
    const invalid = validateQuestions(questions);
    if (invalid) throw new Error(invalid);
    const store = await engine();
    const { contest, created } = await store.insertContest({
      generationKey: `custom:${crypto.randomUUID()}`, templateId: null, categoryId: data.categoryId ?? null, matchId: data.matchId ?? null,
      sport: data.sport, trigger: "pre_match", title: data.title, status: data.publish ? "scheduled" : "draft",
      opensAt: data.opensAt, locksAt: data.locksAt, participantLimit: data.participantLimit ?? null, allowEdit: data.allowEdit,
      scoring: data.scoring, questions,
    });
    await store.audit("contest.custom_created", context.adminUserId, contest.id, { title: data.title, publish: data.publish });
    return { id: contest.id, created };
  });

export const listPredContestQuestions = createServerFn({ method: "GET" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({ id }).parse(d))
  .handler(async ({ data }) => {
    const [q, e] = await Promise.all([
      db.from("pred_questions").select("id, position, prompt, options, rule, points, status, resolved_option, void_reason").eq("contest_id", data.id).order("position"),
      db.from("pred_entries").select("id", { count: "exact", head: true }).eq("contest_id", data.id),
    ]);
    if (q.error) throw new Error(q.error.message);
    return { questions: q.data, entries: e.count ?? 0 };
  });

/** The ONLY way an administrator can set or change a result. Requires a reason; logged in pred_corrections. */
export const correctPredQuestion = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({
    contestId: id, questionId: id, reason: z.string().trim().min(5).max(300),
    result: z.union([z.object({ status: z.literal("resolved"), optionId: z.string().min(1).max(40) }), z.object({ status: z.literal("void"), reason: z.string().trim().min(3).max(120) })]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { correctQuestion } = await import("@/lib/pred/engine");
    return correctQuestion(await engine(), data.contestId, data.questionId, data.result, context.adminUserId, data.reason, Date.now());
  });

export const runPredNow = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({ refreshFixtures: z.boolean().default(true) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { runPredTick } = await import("@/lib/pred/sync.server");
    const out = await runPredTick({ trigger: "manual", refreshFixtures: data.refreshFixtures });
    await (await engine()).audit("tick.manual", context.adminUserId, "tick", { skipped: out.skipped ?? null });
    return out;
  });

/** Dry run: fetches the ball-by-ball feed and reports how many rows were recognised. Stores nothing. */
export const testPredBallFeed = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission(PERM)])
  .inputValidator((d) => z.object({ matchId: id }).parse(d))
  .handler(async ({ data }) => {
    const { readSportsConfig } = await import("@/lib/sports.server");
    const { fetchBallPayload } = await import("@/lib/pred/sync.server");
    const { normalizeBalls } = await import("@/lib/pred/ball-feed");
    const cfg = await readSportsConfig();
    if (!cfg.apiKey) throw new Error("Provider key is not configured.");
    const { data: m, error } = await db.from("cricket_matches").select("external_id, name").eq("id", data.matchId).maybeSingle();
    if (error || !m) throw new Error("Match not found.");
    if (String(m.external_id).startsWith("sportmonks:")) throw new Error("Ball-by-ball is only wired for the primary provider.");
    const parsed = normalizeBalls(await fetchBallPayload(m.external_id, cfg.apiKey));
    return { match: m.name as string, total: parsed.total, recognised: parsed.events.length, rejected: parsed.rejected, sample: parsed.events.slice(0, 6) };
  });
