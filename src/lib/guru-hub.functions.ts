import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { guruGenerateQuestions, guruProgress } from "@/lib/guru.server";

/** Library: every curriculum book the student can open, with its chapter count. */
export const getGuruLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().trim().max(80).optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    let q = supabase
      .from("guru_books")
      .select("id, title, publisher, subject_id, guru_subjects(name, emoji, guru_classes(name, guru_boards(name, short_name)))")
      .eq("active", true)
      .order("title")
      .limit(120);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    const { data: books } = await q;

    const ids = (books ?? []).map((b) => b.id);
    const counts = new Map<string, number>();
    const firstChapter = new Map<string, string>();
    if (ids.length) {
      const { data: chapters } = await supabase
        .from("guru_chapters")
        .select("id, book_id")
        .in("book_id", ids)
        .eq("active", true)
        .order("sort_order");
      for (const c of chapters ?? []) {
        const bookId = c.book_id;
        if (!bookId) continue;
        counts.set(bookId, (counts.get(bookId) ?? 0) + 1);
        if (!firstChapter.has(bookId)) firstChapter.set(bookId, c.id);
      }
    }

    return (books ?? []).map((b) => {
      const subject = b.guru_subjects as {
        name?: string;
        emoji?: string;
        guru_classes?: { name?: string; guru_boards?: { name?: string; short_name?: string } };
      } | null;
      return {
        id: b.id,
        title: b.title,
        publisher: b.publisher ?? "",
        subject: subject?.name ?? "",
        emoji: subject?.emoji ?? "📘",
        className: subject?.guru_classes?.name ?? "",
        board: subject?.guru_classes?.guru_boards?.short_name ?? subject?.guru_classes?.guru_boards?.name ?? "",
        chapters: counts.get(b.id) ?? 0,
        firstChapterId: firstChapter.get(b.id) ?? null,
      };
    });
  });

/** Chapters + topics inside one library book. */
export const getGuruBook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ book_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: chapters } = await supabase
      .from("guru_chapters")
      .select("id, title, chapter_number, summary, guru_topics(id, title, difficulty, estimated_minutes, active, sort_order)")
      .eq("book_id", data.book_id)
      .eq("active", true)
      .order("sort_order");
    return (chapters ?? []).map((c) => ({
      id: c.id,
      title: c.chapter_number ? `${c.chapter_number}. ${c.title}` : c.title,
      summary: c.summary ?? "",
      topics: ((c.guru_topics as { id: string; title: string; difficulty: string; estimated_minutes: number; active: boolean; sort_order: number }[]) ?? [])
        .filter((t) => t.active)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((t) => ({ id: t.id, title: t.title, difficulty: t.difficulty, minutes: t.estimated_minutes })),
    }));
  });

/** Competition Hub: platform contests (read-only) + the student's Guru ranking snapshot. */
export const getGuruCompetitionHub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const [contestRes, meRes, topRes] = await Promise.all([
      supabase
        .from("contests")
        .select("id, title, entry_fee, prize_pool, num_questions, contest_type, starts_at, ends_at, results_status")
        .eq("active", true)
        .order("starts_at", { ascending: true })
        .limit(12),
      supabase.from("guru_student_xp").select("xp, level, questions_solved").eq("user_id", userId).maybeSingle(),
      supabase.from("guru_student_xp").select("user_id, xp, level").order("xp", { ascending: false }).limit(10),
    ]);

    const contests = (contestRes.data ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      entryFee: Number(c.entry_fee ?? 0),
      prizePool: Number(c.prize_pool ?? 0),
      questions: c.num_questions ?? 0,
      type: c.contest_type ?? "quiz",
      startsAt: c.starts_at,
      endsAt: c.ends_at,
      live: Boolean(c.starts_at && c.starts_at <= nowIso && (!c.ends_at || c.ends_at >= nowIso)),
      resultsDeclared: c.results_status === "declared",
    }));

    const board = (topRes.data ?? []).map((r, i) => ({
      rank: i + 1,
      xp: Number(r.xp ?? 0),
      level: Number(r.level ?? 1),
      isMe: r.user_id === userId,
    }));

    return {
      contests,
      me: { xp: Number(meRes.data?.xp ?? 0), level: Number(meRes.data?.level ?? 1), solved: Number(meRes.data?.questions_solved ?? 0) },
      board,
    };
  });

/** Practice challenge: AI questions for a Guru module (skills, library, competition, galaxy). */
export const generateGuruChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        subject: z.string().trim().min(2).max(80),
        focus: z.string().trim().max(120).optional(),
        count: z.number().int().min(3).max(10).default(5),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("guru_student_xp").select("preferred_language").eq("user_id", userId).maybeSingle();
    const questions = await guruGenerateQuestions({
      topic: data.focus ? `${data.subject} — ${data.focus}` : data.subject,
      objectives: data.focus ? [data.focus] : [],
      board: null,
      className: null,
      subject: data.subject,
      lesson: null,
      language: row?.preferred_language ?? "en",
      count: data.count,
    });
    return { questions, aiEnabled: questions.length > 0 };
  });

/** Records a Guru challenge (no topic row involved) and awards XP. */
export const submitGuruChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ correct: z.number().int().min(0), total: z.number().int().min(1), label: z.string().trim().max(120).default("Guru Challenge") }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const accuracy = Math.round((data.correct / data.total) * 100);
    const xpEarned = data.correct * 8 + (accuracy >= 80 ? 20 : 0);
    const { data: row } = await supabase.from("guru_student_xp").select("xp, questions_solved").eq("user_id", userId).maybeSingle();
    const newXp = Number(row?.xp ?? 0) + xpEarned;
    await supabase.from("guru_student_xp").upsert(
      {
        user_id: userId,
        xp: newXp,
        level: guruProgress(newXp).level,
        questions_solved: Number(row?.questions_solved ?? 0) + data.total,
      },
      { onConflict: "user_id" },
    );
    return { xpEarned, accuracy, xp: newXp, level: guruProgress(newXp).level };
  });

/** Galaxy Classroom: each subject is a planet whose glow is the student's mastery. */
export const getGuruGalaxy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows } = await supabase
      .from("guru_student_topic_progress")
      .select("mastery, status, guru_topics(title, guru_chapters(guru_books(guru_subjects(name, emoji))))")
      .eq("user_id", userId)
      .limit(500);

    const planets = new Map<string, { subject: string; emoji: string; topics: number; mastered: number; mastery: number }>();
    for (const r of rows ?? []) {
      const subject = (r.guru_topics as { guru_chapters?: { guru_books?: { guru_subjects?: { name?: string; emoji?: string } } } } | null)
        ?.guru_chapters?.guru_books?.guru_subjects;
      const name = subject?.name ?? "Exploration";
      const p = planets.get(name) ?? { subject: name, emoji: subject?.emoji ?? "🪐", topics: 0, mastered: 0, mastery: 0 };
      p.topics += 1;
      p.mastered += r.status === "mastered" ? 1 : 0;
      p.mastery += Number(r.mastery ?? 0);
      planets.set(name, p);
    }

    const list = [...planets.values()]
      .map((p) => ({ ...p, mastery: Math.round(p.mastery / Math.max(1, p.topics)) }))
      .sort((a, b) => b.mastery - a.mastery);

    return {
      planets: list,
      explored: list.reduce((s, p) => s + p.topics, 0),
      mastered: list.reduce((s, p) => s + p.mastered, 0),
    };
  });
