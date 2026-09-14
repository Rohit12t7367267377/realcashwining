import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword, requireAdminPermission } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALLOWED = [
  "memberships",
  "coupons",
  "faqs",
  "banners",
  "broadcasts",
  "app_updates",
  "cricket_matches",
] as const;
type Table = (typeof ALLOWED)[number];

const tableSchema = z.enum(ALLOWED);

export const adminUpsertRow = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({
      table: tableSchema,
      id: z.string().uuid().optional(),
      values: z.record(z.string(), z.any()),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const table = data.table as Table;
    const client = supabaseAdmin as any;
    if (data.id) {
      const { error } = await client.from(table).update(data.values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await client.from(table).insert(data.values);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminDeleteRow = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({ table: tableSchema, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// KYC review
export const adminReviewKyc = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected"]),
      admin_note: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("kyc_submissions").update({
      status: data.status,
      admin_note: data.admin_note ?? null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Fraud flag CRUD
export const adminListFraud = createServerFn({ method: "GET" })
  .middleware([requireAdminPermission("security.view")])
  .handler(async () => {
    const [{ data: flags, error: flagsError }, { data: events, error: eventsError }] = await Promise.all([
      supabaseAdmin.from("fraud_flags").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("anticheat_events").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (flagsError) throw new Error(flagsError.message);
    if (eventsError) throw new Error(eventsError.message);
    const ids = Array.from(new Set([...(flags ?? []), ...(events ?? [])].map((row: any) => row.user_id).filter(Boolean)));
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, username").in("id", ids)
      : { data: [] as any[] };
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name || profile.username || profile.id.slice(0, 8)]));
    const nameRows = (rows: any[]) => rows.map((row) => ({ ...row, profileName: names.get(row.user_id) ?? row.user_id?.slice(0, 8) ?? "—" }));
    return { flags: nameRows(flags ?? []), events: nameRows(events ?? []) };
  });

export const adminResolveFraud = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission("community.moderate")])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), resolved: z.boolean(), admin_note: z.string().trim().min(3).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: before } = await supabaseAdmin.from("fraud_flags").select("resolved, admin_note, user_id, reason, severity").eq("id", data.id).single();
    const { error } = await supabaseAdmin.from("fraud_flags").update({
      resolved: data.resolved,
      admin_note: data.admin_note,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await (supabaseAdmin as any).rpc("write_admin_audit", {
      _actor_id: context.adminUserId, _permission: "community.moderate", _action: data.resolved ? "fraud.resolve" : "fraud.reopen",
      _target_type: "fraud_flag", _target_id: data.id, _result: "success", _reason: data.admin_note,
      _before: before ?? {}, _after: { ...(before ?? {}), resolved: data.resolved, admin_note: data.admin_note }, _metadata: {},
    });
    return { ok: true };
  });

export const adminCreateFraud = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({
      user_id: z.string().uuid(),
      reason: z.string().min(1).max(300),
      severity: z.enum(["low", "medium", "high"]).default("medium"),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("fraud_flags").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Feedback reply
export const adminReplyFeedback = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      admin_reply: z.string().max(2000),
      status: z.enum(["open", "resolved", "closed"]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("feedback").update({
      admin_reply: data.admin_reply,
      status: data.status,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Moderate comment
export const adminHideComment = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid(), hidden: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("contest_comments").update({ hidden: data.hidden }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Community moderation
export const adminSetPostHidden = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid(), hidden: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("community_posts").update({ hidden: data.hidden }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePost = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("community_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetPostCommentHidden = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid(), hidden: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("post_comments").update({ hidden: data.hidden }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

