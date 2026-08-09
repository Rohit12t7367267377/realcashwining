import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: web push config for the browser (empty strings until FCM keys are added). */
export const getPushConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { getWebPushConfig, isPushConfigured } = await import("./push.server");
  return { ...getWebPushConfig(), configured: isPushConfigured() };
});

export const registerPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        token: z.string().trim().min(20).max(4096),
        platform: z.string().trim().max(30).default("web"),
        userAgent: z.string().trim().max(400).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_tokens")
      .upsert(
        {
          user_id: context.userId,
          token: data.token,
          platform: data.platform,
          user_agent: data.userAgent ?? null,
          enabled: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disablePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ token: z.string().trim().min(20).max(4096) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_tokens")
      .update({ enabled: false })
      .eq("token", data.token)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Campaigns that were actually delivered to this user, for the in-app feed. */
export const listMyPushMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: deliveries } = await context.supabase
      .from("push_deliveries")
      .select("campaign_id,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    const ids = Array.from(new Set((deliveries ?? []).map((d) => d.campaign_id)));
    if (!ids.length) return { items: [] as any[] };
    const { data: campaigns } = await context.supabase
      .from("push_campaigns")
      .select("id,title,body,deep_link,sent_at,created_at,event_code")
      .in("id", ids)
      .eq("status", "sent")
      .order("created_at", { ascending: false });
    return { items: campaigns ?? [] };
  });
