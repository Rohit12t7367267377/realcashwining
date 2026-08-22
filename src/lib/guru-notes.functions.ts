import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildClassNotes, answerNotesDoubt, suggestChapterList } from "@/lib/guru-notes.server";

const scope = {
  board: z.string().trim().min(1).max(60),
  className: z.string().trim().min(1).max(10),
  subject: z.string().trim().min(1).max(80),
  language: z.enum(["en", "hi"]).default("en"),
};

/** Chapter/topic list for a board + class + subject (AI generated from the syllabus). */
export const listNotesChapters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object(scope).parse(d))
  .handler(async ({ data }) => suggestChapterList(data));

/** Full teacher-style notes for one topic. */
export const getClassNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...scope, topic: z.string().trim().min(2).max(160) }).parse(d))
  .handler(async ({ data }) => buildClassNotes(data));

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
