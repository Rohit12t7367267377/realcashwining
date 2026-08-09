import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";

const audienceEnum = z.enum(["all", "selected", "premium", "category", "contest"]);

const campaignInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1000),
  image_url: z.string().trim().max(600).optional().nullable(),
  deep_link: z.string().trim().max(300).optional().nullable(),
  data: z.record(z.string(), z.string()).optional(),
  audience: audienceEnum,
  target_user_ids: z.array(z.string().uuid()).max(5000).optional(),
  category_id: z.string().uuid().optional().nullable(),
  contest_id: z.string().uuid().optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
  send_now: z.boolean().optional(),
});

export const adminSaveCampaign = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => campaignInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const values = {
      title: data.title,
      body: data.body,
      image_url: data.image_url || null,
      deep_link: data.deep_link || null,
      data: data.data ?? {},
      audience: data.audience,
      target_user_ids: data.target_user_ids ?? [],
      category_id: data.category_id || null,
      contest_id: data.contest_id || null,
      scheduled_at: data.send_now ? new Date().toISOString() : data.scheduled_at || null,
      status: data.send_now ? "queued" : data.scheduled_at ? "scheduled" : "draft",
    };

    let id = data.id;
    if (id) {
      const { error } = await admin.from("push_campaigns").update(values).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await admin.from("push_campaigns").insert(values).select("id").single();
      if (error) throw new Error(error.message);
      id = row.id as string;
    }

    if (data.send_now) {
      const { dispatchCampaign } = await import("@/lib/push-dispatch.server");
      const result = await dispatchCampaign(id!);
      return { id, ...result };
    }
    return { id, recipients: 0, sent: 0, failed: 0, pushConfigured: true };
  });

export const adminSendCampaign = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { dispatchCampaign } = await import("@/lib/push-dispatch.server");
    return dispatchCampaign(data.id);
  });

export const adminDeleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("push_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const [{ data: campaigns }, { count: tokenCount }, { count: activeTokens }] = await Promise.all([
      admin.from("push_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
      admin.from("push_tokens").select("id", { count: "exact", head: true }),
      admin.from("push_tokens").select("id", { count: "exact", head: true }).eq("enabled", true),
    ]);
    const { isPushConfigured } = await import("@/lib/push.server");
    return {
      campaigns: campaigns ?? [],
      tokens: tokenCount ?? 0,
      activeTokens: activeTokens ?? 0,
      pushConfigured: isPushConfigured(),
    };
  });

export const adminCampaignDeliveries = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: rows } = await admin
      .from("push_deliveries")
      .select("id,user_id,status,error,created_at")
      .eq("campaign_id", data.id)
      .order("created_at", { ascending: false })
      .limit(300);
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    const { data: profiles } = ids.length
      ? await admin.from("profiles").select("id,full_name,phone,username").in("id", ids)
      : { data: [] };
    const byId = new Map<string, any>((profiles ?? []).map((p: any) => [p.id as string, p]));
    return {
      rows: (rows ?? []).map((r: any) => {
        const p = byId.get(r.user_id);
        return { ...r, name: p?.full_name || p?.username || p?.phone || "User" };
      }),
    };

  });

/** Search users for the "selected users" audience. */
export const adminSearchUsers = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ q: z.string().trim().max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    let query = admin.from("profiles").select("id,full_name,phone,username").limit(25);
    if (data.q) {
      query = query.or(`full_name.ilike.%${data.q}%,phone.ilike.%${data.q}%,username.ilike.%${data.q}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
