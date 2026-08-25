import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Everything the admin catalogue screen needs in one call. */
export const adminGetCatalog = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const [exams, examSubjects, examTopics, degrees, regulations, subjects, units, topics] = await Promise.all([
      supabaseAdmin.from("guru_exams").select("*").order("sort_order"),
      supabaseAdmin.from("guru_exam_subjects").select("*").order("sort_order"),
      supabaseAdmin.from("guru_exam_topics").select("*").order("sort_order"),
      supabaseAdmin.from("guru_college_degrees").select("*").order("sort_order"),
      supabaseAdmin.from("guru_college_regulations").select("*").order("sort_order"),
      supabaseAdmin.from("guru_college_subjects").select("*").order("sort_order"),
      supabaseAdmin.from("guru_college_units").select("*").order("sort_order"),
      supabaseAdmin.from("guru_college_topics").select("*").order("sort_order"),
    ]);
    return {
      exams: exams.data ?? [],
      examSubjects: examSubjects.data ?? [],
      examTopics: examTopics.data ?? [],
      degrees: degrees.data ?? [],
      regulations: regulations.data ?? [],
      subjects: subjects.data ?? [],
      units: units.data ?? [],
      topics: topics.data ?? [],
    };
  });

const TABLES = {
  exam: "guru_exams",
  exam_subject: "guru_exam_subjects",
  exam_topic: "guru_exam_topics",
  degree: "guru_college_degrees",
  regulation: "guru_college_regulations",
  college_subject: "guru_college_subjects",
  college_unit: "guru_college_units",
  college_topic: "guru_college_topics",
} as const;

const entity = z.enum([
  "exam",
  "exam_subject",
  "exam_topic",
  "degree",
  "regulation",
  "college_subject",
  "college_unit",
  "college_topic",
]);

/** Insert or update any catalogue row (exams, subjects, topics, degrees, units…). */
export const adminSaveCatalogRow = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        entity,
        id: z.string().uuid().optional(),
        values: z.record(z.string(), z.any()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const table = TABLES[data.entity];
    if (data.id) {
      const { error } = await supabaseAdmin.from(table).update(data.values).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from(table).insert(data.values).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id ?? null };
  });

/** Delete a catalogue row (children cascade). */
export const adminDeleteCatalogRow = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ entity, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from(TABLES[data.entity]).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
