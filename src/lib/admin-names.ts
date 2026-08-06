import { supabase } from "@/integrations/supabase/client";

/**
 * profiles has no PostgREST relationship to most tables (their FKs point at
 * auth.users), so embedded `profiles(...)` selects fail with a 400. Fetch the
 * names separately and attach them instead.
 */
export async function attachProfileNames<T extends Record<string, any>>(
  rows: T[],
  key: keyof T = "user_id" as keyof T,
): Promise<Array<T & { profileName: string }>> {
  const ids = Array.from(new Set(rows.map((r) => r[key]).filter(Boolean))) as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from("profiles").select("id, full_name, username").in("id", ids);
    (data ?? []).forEach((p) => names.set(p.id, p.full_name || p.username || p.id.slice(0, 8)));
  }
  return rows.map((r) => ({
    ...r,
    profileName: names.get(String(r[key] ?? "")) ?? (r[key] ? String(r[key]).slice(0, 8) : "—"),
  }));
}
