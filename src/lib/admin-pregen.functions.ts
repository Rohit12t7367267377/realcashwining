import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";

/**
 * Admin-only: generate and SAVE every chapter, topic, note and quiz of one subject ahead of time,
 * so students never trigger the AI. Safe to call repeatedly: finished work is read from the backend
 * (no AI), and each call stops after a small AI budget so it never times out. Repeat until done=true.
 */
export const adminPregenerateSubject = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({
      board: z.string().trim().min(1).max(150),
      className: z.string().trim().min(1).max(10),
      subject: z.string().trim().min(1).max(80),
      language: z.enum(["en", "hi"]).default("en"),
      withQuiz: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { aiStats } = await import("@/lib/ai-gateway.server");
    const { resolveChapters, resolveTopics } = await import("@/lib/guru-notes-resolve.server");
    const { buildClassNotes, buildTopicQuiz } = await import("@/lib/guru-notes.server");
    const started = Date.now();
    const base = aiStats.misses;
    const out = { chapters: 0, topics: 0, notesReady: 0, quizReady: 0, done: false, error: null as string | null };
    const budgetLeft = () => aiStats.misses - base < 2 && Date.now() - started < 20_000;
    try {
      const chapters = await resolveChapters(data);
      out.chapters = chapters.length;
      let complete = true;
      for (const chapter of chapters) {
        if (!budgetLeft()) { complete = false; break; }
        const topics = await resolveTopics({ ...data, chapter });
        out.topics += topics.length;
        for (const topic of topics) {
          const missesBefore = aiStats.misses;
          if (!budgetLeft()) { complete = false; continue; }
          await buildClassNotes({ ...data, topic });
          out.notesReady += 1;
          if (data.withQuiz) {
            if (!budgetLeft()) { complete = false; continue; }
            await buildTopicQuiz({ ...data, topic });
            out.quizReady += 1;
          }
          void missesBefore;
        }
      }
      out.done = complete;
    } catch (e) {
      out.error = e instanceof Error ? e.message : "Generation failed";
    }
    return out;
  });
