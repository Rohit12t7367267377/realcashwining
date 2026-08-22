import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  guruProgress,
  nextStreak,
  isUnlocked,
  describeRequirement,
  guruTeach,
  guruGenerateQuestions,
  type UnlockStats,
} from "@/lib/guru.server";

/** Ensure the student's Guru.AI profile row exists and roll the daily streak forward. */
export const getGuruDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().slice(0, 10);

    let { data: row } = await supabase.from("guru_student_xp").select("*").eq("user_id", userId).maybeSingle();
    if (!row) {
      const ins = await supabase
        .from("guru_student_xp")
        .insert({ user_id: userId, last_active_date: today, streak_days: 1, best_streak: 1 })
        .select("*")
        .maybeSingle();
      row = ins.data ?? null;
    } else {
      const s = nextStreak(row.last_active_date, Number(row.streak_days ?? 0), today);
      if (s.changed) {
        const upd = await supabase
          .from("guru_student_xp")
          .update({
            streak_days: s.streak,
            best_streak: Math.max(Number(row.best_streak ?? 0), s.streak),
            last_active_date: today,
          })
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();
        row = upd.data ?? row;
      }
    }

    const xp = Number(row?.xp ?? 0);
    const prog = guruProgress(xp);

    const [charRes, recentRes, badgeRes] = await Promise.all([
      row?.selected_character_id
        ? supabase.from("guru_characters").select("*").eq("id", row.selected_character_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("guru_student_topic_progress")
        .select("id, status, mastery, last_opened_at, topic_id, guru_topics(id, title, difficulty)")
        .eq("user_id", userId)
        .order("last_opened_at", { ascending: false })
        .limit(5),
      supabase.from("guru_badges").select("*").eq("active", true).order("sort_order").limit(8),
    ]);

    return {
      xp,
      level: prog.level,
      nextLevelXp: prog.next,
      progress: prog.progress,
      streak: Number(row?.streak_days ?? 0),
      bestStreak: Number(row?.best_streak ?? 0),
      lessonsCompleted: Number(row?.lessons_completed ?? 0),
      questionsSolved: Number(row?.questions_solved ?? 0),
      language: row?.preferred_language ?? "en",
      character: charRes.data ?? null,
      recent: (recentRes.data ?? []).map((r) => ({
        topic_id: r.topic_id,
        title: (r.guru_topics as { title?: string } | null)?.title ?? "Topic",
        status: r.status,
        mastery: Number(r.mastery ?? 0),
      })),
      badges: badgeRes.data ?? [],
    };
  });

export const setGuruLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ language: z.enum(["en", "hi"]) }).parse(d))
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("guru_student_xp")
      .upsert({ user_id: context.userId, preferred_language: data.language }, { onConflict: "user_id" });
    return { ok: true };
  });

export const listGuruCharacters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [chars, xpRow, costumes, inv] = await Promise.all([
      supabase.from("guru_characters").select("*").eq("active", true).order("sort_order"),
      supabase.from("guru_student_xp").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("guru_character_costumes").select("*").eq("active", true).order("sort_order"),
      supabase.from("guru_character_inventory").select("*").eq("user_id", userId),
    ]);
    const row = xpRow.data;
    const stats: Partial<UnlockStats> = {
      lessons_completed: Number(row?.lessons_completed ?? 0),
      questions_solved: Number(row?.questions_solved ?? 0),
      streak_days: Number(row?.streak_days ?? 0),
    };
    const owned = new Set((inv.data ?? []).map((i) => i.character_id ?? i.costume_id ?? ""));
    return {
      selectedId: row?.selected_character_id ?? null,
      characters: (chars.data ?? []).map((c) => ({
        ...c,
        unlocked: c.unlock_type === "free" || owned.has(c.id) || isUnlocked(c.unlock_requirement, stats),
        requirementText: describeRequirement(c.unlock_requirement),
      })),
      costumes: (costumes.data ?? []).map((c) => ({
        ...c,
        unlocked: c.unlock_type === "free" || owned.has(c.id) || isUnlocked(c.unlock_requirement, stats),
        requirementText: describeRequirement(c.unlock_requirement),
      })),
    };
  });

export const selectGuruCharacter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ character_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: char } = await supabase
      .from("guru_characters")
      .select("id, unlock_type, unlock_requirement")
      .eq("id", data.character_id)
      .maybeSingle();
    if (!char) throw new Error("Character not found");
    const { data: row } = await supabase.from("guru_student_xp").select("*").eq("user_id", userId).maybeSingle();
    const stats: Partial<UnlockStats> = {
      lessons_completed: Number(row?.lessons_completed ?? 0),
      questions_solved: Number(row?.questions_solved ?? 0),
      streak_days: Number(row?.streak_days ?? 0),
    };
    if (char.unlock_type !== "free" && !isUnlocked(char.unlock_requirement, stats)) {
      throw new Error(describeRequirement(char.unlock_requirement));
    }
    await supabase
      .from("guru_student_xp")
      .upsert({ user_id: userId, selected_character_id: char.id }, { onConflict: "user_id" });
    await supabase
      .from("guru_character_progress")
      .upsert({ user_id: userId, character_id: char.id }, { onConflict: "user_id,character_id" });
    return { ok: true };
  });

/** School browser: one function drives every level of the curriculum tree. */
export const browseCurriculum = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        level: z.enum(["boards", "classes", "subjects", "books", "chapters", "topics"]),
        parentId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { level, parentId } = data;
    if (level === "boards") {
      const { data: rows } = await supabase.from("guru_boards").select("*").eq("active", true).order("sort_order");
      return (rows ?? []).map((r) => ({ id: r.id, title: r.name, subtitle: r.short_name ?? r.region ?? "" }));
    }
    if (!parentId) return [];
    if (level === "classes") {
      const { data: rows } = await supabase
        .from("guru_classes")
        .select("*")
        .eq("board_id", parentId)
        .eq("active", true)
        .order("sort_order");
      return (rows ?? []).map((r) => ({ id: r.id, title: r.name, subtitle: "" }));
    }
    if (level === "subjects") {
      const { data: rows } = await supabase
        .from("guru_subjects")
        .select("*")
        .eq("class_id", parentId)
        .eq("active", true)
        .order("sort_order");
      return (rows ?? []).map((r) => ({ id: r.id, title: `${r.emoji} ${r.name}`, subtitle: "" }));
    }
    if (level === "books") {
      const { data: rows } = await supabase
        .from("guru_books")
        .select("*")
        .eq("subject_id", parentId)
        .eq("active", true)
        .order("sort_order");
      return (rows ?? []).map((r) => ({ id: r.id, title: r.title, subtitle: r.publisher ?? "" }));
    }
    if (level === "chapters") {
      const { data: rows } = await supabase
        .from("guru_chapters")
        .select("*")
        .eq("book_id", parentId)
        .eq("active", true)
        .order("sort_order");
      return (rows ?? []).map((r) => ({
        id: r.id,
        title: r.chapter_number ? `${r.chapter_number}. ${r.title}` : r.title,
        subtitle: r.summary ?? "",
      }));
    }
    const { data: rows } = await supabase
      .from("guru_topics")
      .select("*")
      .eq("chapter_id", parentId)
      .eq("active", true)
      .order("sort_order");
    return (rows ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: `${r.difficulty} • ${r.estimated_minutes} min`,
    }));
  });

export const getGuruTopic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ topic_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: topic } = await supabase
      .from("guru_topics")
      .select("*, guru_chapters(id, title, guru_books(id, title, guru_subjects(name, guru_classes(name, guru_boards(name)))))")
      .eq("id", data.topic_id)
      .maybeSingle();
    if (!topic) throw new Error("Topic not found");
    const { data: lessons } = await supabase
      .from("guru_lessons")
      .select("*")
      .eq("topic_id", data.topic_id)
      .eq("active", true)
      .order("sort_order");
    const { data: progress } = await supabase
      .from("guru_student_topic_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("topic_id", data.topic_id)
      .maybeSingle();
    await supabase
      .from("guru_student_topic_progress")
      .upsert(
        { user_id: userId, topic_id: data.topic_id, status: progress?.status ?? "in_progress", last_opened_at: new Date().toISOString() },
        { onConflict: "user_id,topic_id" },
      );

    const chapter = topic.guru_chapters as { title?: string; guru_books?: { title?: string; guru_subjects?: { name?: string; guru_classes?: { name?: string; guru_boards?: { name?: string } } } } } | null;
    const book = chapter?.guru_books ?? null;
    const subject = book?.guru_subjects ?? null;
    const klass = subject?.guru_classes ?? null;

    return {
      id: topic.id,
      title: topic.title,
      difficulty: topic.difficulty,
      minutes: topic.estimated_minutes,
      objectives: Array.isArray(topic.objectives) ? (topic.objectives as string[]) : [],
      lessons: lessons ?? [],
      breadcrumb: {
        board: klass?.guru_boards?.name ?? null,
        className: klass?.name ?? null,
        subject: subject?.name ?? null,
        book: book?.title ?? null,
        chapter: chapter?.title ?? null,
      },
      mastery: Number(progress?.mastery ?? 0),
      status: progress?.status ?? "in_progress",
    };
  });

/** Ask the selected AI character. Creates/continues a session and stores both messages. */
export const guruAsk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        question: z.string().trim().min(1).max(4000),
        intent: z.enum(["learn", "doubt", "simple", "practice", "quiz", "revise", "chat"]).default("chat"),
        scope: z.enum(["school", "universal", "skills", "library", "galaxy"]).default("universal"),
        topic_id: z.string().uuid().optional(),
        session_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("guru_student_xp").select("*").eq("user_id", userId).maybeSingle();
    const language = row?.preferred_language ?? "en";

    const { data: character } = row?.selected_character_id
      ? await supabase
          .from("guru_characters")
          .select("name, personality, teaching_style, tone")
          .eq("id", row.selected_character_id)
          .maybeSingle()
      : { data: null };

    let topicCtx: { title: string; objectives: string[]; lesson?: string | null } | null = null;
    let breadcrumb: { board?: string | null; className?: string | null; subject?: string | null } = {};
    if (data.topic_id) {
      const { data: topic } = await supabase
        .from("guru_topics")
        .select("title, objectives, guru_chapters(guru_books(guru_subjects(name, guru_classes(name, guru_boards(name)))))")
        .eq("id", data.topic_id)
        .maybeSingle();
      const { data: lesson } = await supabase
        .from("guru_lessons")
        .select("body")
        .eq("topic_id", data.topic_id)
        .eq("active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      if (topic) {
        topicCtx = {
          title: topic.title,
          objectives: Array.isArray(topic.objectives) ? (topic.objectives as string[]) : [],
          lesson: lesson?.body ?? null,
        };
        const subject = (topic.guru_chapters as { guru_books?: { guru_subjects?: { name?: string; guru_classes?: { name?: string; guru_boards?: { name?: string } } } } } | null)?.guru_books?.guru_subjects;
        breadcrumb = {
          subject: subject?.name ?? null,
          className: subject?.guru_classes?.name ?? null,
          board: subject?.guru_classes?.guru_boards?.name ?? null,
        };
      }
    }

    let sessionId = data.session_id ?? null;
    if (!sessionId) {
      const { data: created, error } = await supabase
        .from("guru_ai_sessions")
        .insert({
          user_id: userId,
          scope: data.scope,
          topic_id: data.topic_id ?? null,
          character_id: row?.selected_character_id ?? null,
          language,
          title: data.question.slice(0, 60),
        })
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      sessionId = created?.id ?? null;
    }
    if (!sessionId) throw new Error("Could not start a Guru.AI session");

    await supabase.from("guru_ai_messages").insert({
      user_id: userId,
      session_id: sessionId,
      role: "user",
      content: data.question,
      intent: data.intent,
    });

    let reply: string;
    let provider = "offline";
    let usedSources: Array<{ id: string; title: string }> = [];
    try {
      const { retrieveGuruContext, formatSources } = await import("@/lib/guru-rag.server");
      const passages = await retrieveGuruContext(supabase as never, {
        query: data.question,
        topicId: data.topic_id ?? null,
        scope: data.scope === "universal" ? null : data.scope,
        limit: 5,
      });
      usedSources = passages.map((p) => ({ id: p.id, title: p.title }));
      const out = await guruTeach({
        intent: data.intent,
        question: data.question,
        language,
        character: character ?? null,
        topic: topicCtx,
        board: breadcrumb.board ?? null,
        className: breadcrumb.className ?? null,
        subject: breadcrumb.subject ?? null,
        sources: formatSources(passages) || null,
      });
      reply = out.content;
      provider = out.provider;
    } catch (e) {
      reply = e instanceof Error ? e.message : "Guru.AI could not answer right now. Please try again.";
      provider = "error";
    }


    const { data: saved } = await supabase
      .from("guru_ai_messages")
      .insert({ user_id: userId, session_id: sessionId, role: "assistant", content: reply, meta: { provider } })
      .select("id, content, role, created_at")
      .maybeSingle();

    return { session_id: sessionId, reply, provider, message_id: saved?.id ?? null };
  });

export const listGuruMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows } = await context.supabase
      .from("guru_ai_messages")
      .select("id, role, content, intent, created_at")
      .eq("session_id", data.session_id)
      .order("created_at", { ascending: true })
      .limit(200);
    return rows ?? [];
  });

export const listGuruSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scope: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("guru_ai_sessions")
      .select("id, title, scope, topic_id, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data.scope) q = q.eq("scope", data.scope);
    const { data: rows } = await q;
    return rows ?? [];
  });

/** Topic mastery test — AI generated from the topic's own objectives and lesson. */
export const generateTopicTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ topic_id: z.string().uuid(), count: z.number().int().min(3).max(10).default(5) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("guru_student_xp").select("preferred_language").eq("user_id", userId).maybeSingle();
    const { data: topic } = await supabase
      .from("guru_topics")
      .select("title, objectives, guru_chapters(guru_books(guru_subjects(name, guru_classes(name, guru_boards(name)))))")
      .eq("id", data.topic_id)
      .maybeSingle();
    if (!topic) throw new Error("Topic not found");
    const { data: lesson } = await supabase
      .from("guru_lessons")
      .select("body")
      .eq("topic_id", data.topic_id)
      .eq("active", true)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    const subject = (topic.guru_chapters as { guru_books?: { guru_subjects?: { name?: string; guru_classes?: { name?: string; guru_boards?: { name?: string } } } } } | null)?.guru_books?.guru_subjects;
    const questions = await guruGenerateQuestions({
      topic: topic.title,
      objectives: Array.isArray(topic.objectives) ? (topic.objectives as string[]) : [],
      board: subject?.guru_classes?.guru_boards?.name ?? null,
      className: subject?.guru_classes?.name ?? null,
      subject: subject?.name ?? null,
      lesson: lesson?.body ?? null,
      language: row?.preferred_language ?? "en",
      count: data.count,
    });
    return { questions, aiEnabled: questions.length > 0 };
  });

/** Records a finished mastery test: XP, mastery and lifetime counters. */
export const submitTopicTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ topic_id: z.string().uuid(), correct: z.number().int().min(0), total: z.number().int().min(1), seconds: z.number().int().min(0).default(0) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const accuracy = Math.round((data.correct / data.total) * 100);
    const xpEarned = data.correct * 10 + (accuracy >= 80 ? 25 : 0);

    const { data: row } = await supabase.from("guru_student_xp").select("*").eq("user_id", userId).maybeSingle();
    const newXp = Number(row?.xp ?? 0) + xpEarned;
    await supabase.from("guru_student_xp").upsert(
      {
        user_id: userId,
        xp: newXp,
        level: guruProgress(newXp).level,
        questions_solved: Number(row?.questions_solved ?? 0) + data.total,
        lessons_completed: Number(row?.lessons_completed ?? 0) + (accuracy >= 60 ? 1 : 0),
      },
      { onConflict: "user_id" },
    );

    const { data: prev } = await supabase
      .from("guru_student_topic_progress")
      .select("mastery")
      .eq("user_id", userId)
      .eq("topic_id", data.topic_id)
      .maybeSingle();
    const mastery = Math.max(Number(prev?.mastery ?? 0), accuracy);
    await supabase.from("guru_student_topic_progress").upsert(
      {
        user_id: userId,
        topic_id: data.topic_id,
        mastery,
        status: mastery >= 80 ? "mastered" : "in_progress",
        completed_at: mastery >= 80 ? new Date().toISOString() : null,
        last_opened_at: new Date().toISOString(),
      },
      { onConflict: "user_id,topic_id" },
    );

    await supabase.from("guru_learning_sessions").insert({
      user_id: userId,
      topic_id: data.topic_id,
      mode: "test",
      seconds_spent: data.seconds,
      xp_earned: xpEarned,
      completed: true,
      ended_at: new Date().toISOString(),
    });

    return { xpEarned, accuracy, mastery, level: guruProgress(newXp).level, xp: newXp };
  });

export const getMyGuruLearning = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [progressRes, sessionsRes, xpRes] = await Promise.all([
      supabase
        .from("guru_student_topic_progress")
        .select("topic_id, status, mastery, last_opened_at, guru_topics(title, difficulty)")
        .eq("user_id", userId)
        .order("last_opened_at", { ascending: false })
        .limit(60),
      supabase
        .from("guru_learning_sessions")
        .select("mode, xp_earned, seconds_spent, started_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(30),
      supabase.from("guru_student_xp").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    const rows = (progressRes.data ?? []).map((r) => ({
      topic_id: r.topic_id,
      title: (r.guru_topics as { title?: string } | null)?.title ?? "Topic",
      difficulty: (r.guru_topics as { difficulty?: string } | null)?.difficulty ?? "easy",
      status: r.status,
      mastery: Number(r.mastery ?? 0),
    }));
    return {
      topics: rows,
      strong: rows.filter((r) => r.mastery >= 80).slice(0, 8),
      weak: rows.filter((r) => r.mastery > 0 && r.mastery < 50).slice(0, 8),
      continueLearning: rows.filter((r) => r.status !== "mastered").slice(0, 6),
      sessions: sessionsRes.data ?? [],
      totals: {
        xp: Number(xpRes.data?.xp ?? 0),
        level: Number(xpRes.data?.level ?? 1),
        streak: Number(xpRes.data?.streak_days ?? 0),
        lessons: Number(xpRes.data?.lessons_completed ?? 0),
        questions: Number(xpRes.data?.questions_solved ?? 0),
        minutes: Math.round((sessionsRes.data ?? []).reduce((a, s) => a + Number(s.seconds_spent ?? 0), 0) / 60),
      },
    };
  });

export const getMyGuruAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [badgesRes, mineRes, xpRes] = await Promise.all([
      supabase.from("guru_badges").select("*").eq("active", true).order("sort_order"),
      supabase.from("guru_achievements").select("*").eq("user_id", userId),
      supabase.from("guru_student_xp").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    const stats: Partial<UnlockStats> = {
      lessons_completed: Number(xpRes.data?.lessons_completed ?? 0),
      questions_solved: Number(xpRes.data?.questions_solved ?? 0),
      streak_days: Number(xpRes.data?.streak_days ?? 0),
    };
    const earned = new Map((mineRes.data ?? []).map((a) => [a.badge_id ?? a.code ?? "", a]));
    return (badgesRes.data ?? []).map((b) => ({
      ...b,
      earned: Boolean(earned.get(b.id)?.earned_at) || isUnlocked(b.criteria, stats),
      requirementText: describeRequirement(b.criteria),
    }));
  });
