import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const adminListAds = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const [{ data: ads }, { data: targets }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("ads").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("ad_targets").select("ad_id, user_id"),
      supabaseAdmin.from("profiles").select("id, full_name, username, phone").limit(500),
    ]);
    const byAd = new Map<string, string[]>();
    (targets ?? []).forEach((t) => {
      const arr = byAd.get(t.ad_id) ?? [];
      arr.push(t.user_id);
      byAd.set(t.ad_id, arr);
    });
    return {
      ads: (ads ?? []).map((a) => ({ ...a, targets: byAd.get(a.id) ?? [] })),
      users: (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name || p.username || p.id.slice(0, 8),
        phone: p.phone ?? "",
      })),
    };
  });

export const adminSaveAd = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(150),
        body: z.string().trim().max(600).optional().nullable(),
        image_url: z.string().trim().max(600).optional().nullable(),
        link_url: z.string().trim().max(600).optional().nullable(),
        cta_label: z.string().trim().max(40).optional().nullable(),
        audience: z.enum(["all", "selected"]).default("all"),
        active: z.boolean().default(true),
        starts_at: z.string().optional().nullable(),
        ends_at: z.string().optional().nullable(),
        targetUserIds: z.array(z.string().uuid()).max(500).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { id, targetUserIds, ...rest } = data;
    const payload = {
      ...rest,
      starts_at: rest.starts_at || null,
      ends_at: rest.ends_at || null,
      updated_at: new Date().toISOString(),
    };
    let adId = id;
    if (adId) {
      const { error } = await supabaseAdmin.from("ads").update(payload).eq("id", adId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabaseAdmin.from("ads").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      adId = row.id;
    }
    await supabaseAdmin.from("ad_targets").delete().eq("ad_id", adId!);
    if (data.audience === "selected" && targetUserIds.length) {
      const { error } = await supabaseAdmin
        .from("ad_targets")
        .insert(targetUserIds.map((u) => ({ ad_id: adId!, user_id: u })));
      if (error) throw new Error(error.message);
    }
    return { ok: true, id: adId };
  });

export const adminDeleteAd = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("ads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
