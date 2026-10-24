import { suggestCollegeList } from "@/lib/guru-college.server";
import type { CollegeItem } from "@/lib/guru-college.functions";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);
const PROG_HINT = /(program|coding|c\+\+|\bc\b|java|python|javascript|data structure|dsa|algorithm|software|web|oop|dbms|sql|compiler|operating system|machine learning|ai\b)/i;

export type CollegeCatalogInput = {
  level: "regulations" | "terms" | "subjects" | "units" | "topics";
  parentId?: string; degree: string; regulation?: string; term?: string; subject?: string; unit?: string;
};

/** One level of the College hierarchy (database first, saved/AI list second). Shared by students and the admin pre-generator. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function collegeCatalog(supabase: any, data: CollegeCatalogInput): Promise<CollegeItem[]> {
    const { level, parentId } = data;

    if (level === "regulations") {
      if (isUuid(parentId)) {
        const { data: rows } = await supabase
          .from("guru_college_regulations")
          .select("id, name, university, sort_order")
          .eq("degree_id", parentId!)
          .eq("active", true)
          .order("sort_order");
        if (rows?.length)
          return rows.map((r: Row) => ({
            id: r.id,
            name: r.university ? `${r.university} — ${r.name}` : r.name,
            emoji: "🏛️",
            fromDb: true,
          }));
      }
      const items = await suggestCollegeList({ level, degree: data.degree });
      return items.map((n) => ({ id: n, name: n, emoji: "🏛️", fromDb: false }));
    }

    if (level === "terms") {
      if (isUuid(parentId)) {
        const { data: rows } = await supabase
          .from("guru_college_subjects")
          .select("term, sort_order")
          .eq("regulation_id", parentId!)
          .eq("active", true)
          .order("sort_order");
        const terms: string[] = Array.from(new Set<string>((rows ?? []).map((r: Row) => String(r.term))));
        if (terms.length) return terms.map((t) => ({ id: t, name: t, emoji: "🗓️", fromDb: true }));
      }
      const items = await suggestCollegeList({ level, degree: data.degree, regulation: data.regulation });
      return items.map((n) => ({ id: n, name: n, emoji: "🗓️", fromDb: false }));
    }

    if (level === "subjects") {
      if (isUuid(data.parentId) && data.term) {
        const { data: rows } = await supabase
          .from("guru_college_subjects")
          .select("id, name, code, is_programming, sort_order")
          .eq("regulation_id", data.parentId!)
          .eq("term", data.term)
          .eq("active", true)
          .order("sort_order");
        if (rows?.length)
          return rows.map((r: Row) => ({
            id: r.id,
            name: r.code ? `${r.name} (${r.code})` : r.name,
            emoji: r.is_programming ? "💻" : "📘",
            fromDb: true,
            programming: r.is_programming,
          }));
      }
      const items = await suggestCollegeList({
        level,
        degree: data.degree,
        regulation: data.regulation,
        term: data.term,
      });
      return items.map((n) => ({
        id: n,
        name: n,
        emoji: PROG_HINT.test(n) ? "💻" : "📘",
        fromDb: false,
        programming: PROG_HINT.test(n),
      }));
    }

    if (level === "units") {
      if (isUuid(parentId)) {
        const { data: rows } = await supabase
          .from("guru_college_units")
          .select("id, unit_number, title, sort_order")
          .eq("subject_id", parentId!)
          .eq("active", true)
          .order("sort_order");
        if (rows?.length)
          return rows.map((r: Row) => ({ id: r.id, name: `Unit ${r.unit_number}: ${r.title}`, emoji: "🧩", fromDb: true }));
      }
      const items = await suggestCollegeList({
        level,
        degree: data.degree,
        regulation: data.regulation,
        term: data.term,
        subject: data.subject,
      });
      return items.map((n) => ({ id: n, name: n, emoji: "🧩", fromDb: false }));
    }

    if (isUuid(parentId)) {
      const { data: rows } = await supabase
        .from("guru_college_topics")
        .select("id, title, sort_order")
        .eq("unit_id", parentId!)
        .eq("active", true)
        .order("sort_order");
      if (rows?.length) return rows.map((r: Row) => ({ id: r.id, name: r.title, emoji: "✨", fromDb: true }));
    }
    const items = await suggestCollegeList({
      level: "topics",
      degree: data.degree,
      regulation: data.regulation,
      term: data.term,
      subject: data.subject,
      unit: data.unit,
    });
    return items.map((n) => ({ id: n, name: n, emoji: "✨", fromDb: false }));
}
