import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Entitlement comes from verified subscription rows, never from client claims. */
export async function requirePremiumMembership(db: SupabaseClient<Database>, userId: string) {
  const now = new Date().toISOString();
  const { data, error } = await db.from("user_memberships")
    .select("id")
    .eq("user_id", userId).eq("status", "active")
    .lte("starts_at", now).gt("ends_at", now).limit(1);
  if (error || !data?.length) throw new Error("An active premium membership is required.");
}