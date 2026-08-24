import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NOTES_BOARDS, NOTES_CLASSES, subjectsForClass } from "@/lib/guru-notes";

export type CatalogItem = { id: string; name: string; emoji: string; fromDb: boolean };

const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

/**
 * Database-driven School catalogue (board → class → subject → chapter → topic).
 * Whatever the admin adds to the guru_* tables is served first; the built-in
 * catalogue is only used as a fallback so the section always works.
 */
export const getSchoolCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        level: z.enum(["boards", "classes", "subjects", "chapters", "topics"]),
        parentId: z.string().max(80).optional(),
        className: z.string().max(10).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<CatalogItem[]> => {
    const { supabase } = context;
    const { level, parentId, className } = data;

    if (level === "boards") {
      const { data: rows } = await supabase
        .from("guru_boards")
        .select("id, name, active, sort_order")
        .eq("active", true)
        .order("sort_order");
      if (rows?.length) return rows.map((r) => ({ id: r.id, name: r.name, emoji: "🏫", fromDb: true }));
      return NOTES_BOARDS.map((b) => ({ id: b.name, name: b.name, emoji: b.emoji, fromDb: false }));
    }

    if (level === "classes") {
      if (isUuid(parentId)) {
        const { data: rows } = await supabase
          .from("guru_classes")
          .select("id, name, active, sort_order")
          .eq("board_id", parentId!)
          .eq("active", true)
          .order("sort_order");
        if (rows?.length) return rows.map((r) => ({ id: r.id, name: r.name, emoji: "📚", fromDb: true }));
      }
      return NOTES_CLASSES.map((c) => ({ id: c, name: c, emoji: "📚", fromDb: false }));
    }

    if (level === "subjects") {
      if (isUuid(parentId)) {
        const { data: rows } = await supabase
          .from("guru_subjects")
          .select("id, name, emoji, active, sort_order")
          .eq("class_id", parentId!)
          .eq("active", true)
          .order("sort_order");
        if (rows?.length)
          return rows.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji ?? "📘", fromDb: true }));
      }
      return subjectsForClass(className ?? "10").map((s) => ({ id: s, name: s, emoji: "📘", fromDb: false }));
    }

    if (level === "chapters") {
      if (isUuid(parentId)) {
        const { data: books } = await supabase
          .from("guru_books")
          .select("id")
          .eq("subject_id", parentId!)
          .eq("active", true);
        const ids = (books ?? []).map((b) => b.id);
        if (ids.length) {
          const { data: rows } = await supabase
            .from("guru_chapters")
            .select("id, title, active, sort_order")
            .in("book_id", ids)
            .eq("active", true)
            .order("sort_order");
          if (rows?.length) return rows.map((r) => ({ id: r.id, name: r.title, emoji: "🔖", fromDb: true }));
        }
      }
      return [];
    }

    // topics
    if (isUuid(parentId)) {
      const { data: rows } = await supabase
        .from("guru_topics")
        .select("id, title, active, sort_order")
        .eq("chapter_id", parentId!)
        .eq("active", true)
        .order("sort_order");
      if (rows?.length) return rows.map((r) => ({ id: r.id, name: r.title, emoji: "✨", fromDb: true }));
    }
    return [];
  });
