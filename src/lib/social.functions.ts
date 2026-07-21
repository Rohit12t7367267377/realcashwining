import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ target_user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.target_user_id === userId) throw new Error("Cannot follow yourself");
    const { data: existing } = await supabase.from("follows")
      .select("follower_id").eq("follower_id", userId).eq("following_id", data.target_user_id).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("follows").delete()
        .eq("follower_id", userId).eq("following_id", data.target_user_id);
      if (error) throw new Error(error.message);
      return { following: false };
    }
    const { error } = await supabase.from("follows").insert({ follower_id: userId, following_id: data.target_user_id });
    if (error) throw new Error(error.message);
    return { following: true };
  });

export const postComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ contest_id: z.string().uuid(), body: z.string().trim().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("contest_comments").insert({
      contest_id: data.contest_id, user_id: userId, body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      rating: z.number().int().min(1).max(5),
      category: z.string().max(60).optional(),
      body: z.string().trim().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("feedback").insert({
      user_id: userId, rating: data.rating, category: data.category ?? null, body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const redeemCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("redeem_coupon", { _code: data.code });
    if (error) throw new Error(error.message);
    const r: any = Array.isArray(rows) ? rows[0] : rows;
    return { amount: Number(r?.amount ?? 0), xp: Number(r?.xp_amount ?? 0), note: r?.note ?? "" };
  });

export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      full_name: z.string().min(2).max(120),
      doc_type: z.enum(["aadhaar", "pan", "passport", "driving_license"]),
      doc_number: z.string().min(4).max(40),
      doc_image_url: z.string().url().optional().nullable(),
      selfie_url: z.string().url().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("kyc_submissions").insert({
      user_id: userId, ...data,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const logAnticheatEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      event_type: z.string().min(1).max(60),
      severity: z.enum(["low", "medium", "high"]).default("low"),
      attempt_id: z.string().uuid().optional(),
      meta: z.record(z.string(), z.any()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("anticheat_events").insert({
      user_id: userId,
      event_type: data.event_type,
      severity: data.severity,
      attempt_id: data.attempt_id ?? null,
      meta: data.meta ?? {},
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bindDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ device_id: z.string().min(4).max(120), user_agent: z.string().max(400).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { data: existing } = await supabase.from("device_bindings")
      .select("id,blocked").eq("user_id", userId).eq("device_id", data.device_id).maybeSingle();
    if (existing) {
      if (existing.blocked) throw new Error("This device has been blocked. Contact support.");
      await supabase.from("device_bindings").update({ last_seen: now }).eq("id", existing.id);
      return { bound: true };
    }
    const { error } = await supabase.from("device_bindings").insert({
      user_id: userId, device_id: data.device_id, user_agent: data.user_agent ?? null, last_seen: now,
    });
    if (error) throw new Error(error.message);
    return { bound: true };
  });

export const purchaseMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ membership_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: m, error: me } = await supabase.from("memberships").select("*").eq("id", data.membership_id).single();
    if (me || !m) throw new Error("Plan not found");
    if (!m.active) throw new Error("Plan is inactive");
    const { data: prof, error: pe } = await supabase.from("profiles").select("wallet_balance").eq("id", userId).single();
    if (pe || !prof) throw new Error("Profile not found");
    if (Number(prof.wallet_balance) < Number(m.price)) throw new Error("Insufficient wallet balance. Add money first.");
    const ends = new Date(Date.now() + m.duration_days * 24 * 3600 * 1000).toISOString();
    const { error: ue } = await supabase.from("profiles").update({ wallet_balance: Number(prof.wallet_balance) - Number(m.price) }).eq("id", userId);
    if (ue) throw new Error(ue.message);
    await supabase.from("transactions").insert({ user_id: userId, type: "debit", amount: m.price, note: `VIP: ${m.name}` });
    const { error: ie } = await supabase.from("user_memberships").insert({
      user_id: userId, membership_id: m.id, ends_at: ends, status: "active",
    });
    if (ie) throw new Error(ie.message);
    return { ok: true, ends_at: ends };
  });
