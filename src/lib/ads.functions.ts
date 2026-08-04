import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Ads the signed-in user should see (global ads + ads targeted at them). */
export const getMyAds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const [{ data: ads }, { data: targets }] = await Promise.all([
      supabase
        .from("ads")
        .select("id, title, body, image_url, link_url, cta_label, audience, starts_at, ends_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("ad_targets").select("ad_id").eq("user_id", userId),
    ]);
    const targeted = new Set((targets ?? []).map((t) => t.ad_id));
    return (ads ?? []).filter((a) => {
      if (a.starts_at && a.starts_at > nowIso) return false;
      if (a.ends_at && a.ends_at < nowIso) return false;
      return a.audience === "all" || targeted.has(a.id);
    });
  });
