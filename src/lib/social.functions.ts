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
      return { following: false, status: "none" as const };
    }
    const { error } = await supabase.from("follows").insert({ follower_id: userId, following_id: data.target_user_id });
    if (error) throw new Error(error.message);
    // The database decides: private accounts turn this into a pending request.
    const { data: row } = await supabase.from("follows").select("status").eq("follower_id", userId).eq("following_id", data.target_user_id).maybeSingle();
    const status = ((row as { status?: string } | null)?.status ?? "accepted") as "pending" | "accepted";
    return { following: status === "accepted", status };
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
      user_id: userId,
      full_name: data.full_name,
      doc_type: data.doc_type,
      doc_number: data.doc_number,
      doc_image_url: data.doc_image_url ?? null,
      selfie_url: data.selfie_url ?? null,
      status: "pending",
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
    const { data: ends, error } = await supabase.rpc("purchase_membership_wallet", { _membership_id: data.membership_id });
    if (error) throw new Error(error.message);
    return { ok: true, ends_at: ends };
  });
