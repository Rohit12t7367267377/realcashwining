import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";
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
    if (data.id) {
      const { error } = await supabaseAdmin.from(table).update(data.values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from(table).insert(data.values);
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
export const adminResolveFraud = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), resolved: z.boolean(), admin_note: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("fraud_flags").update({
      resolved: data.resolved,
      admin_note: data.admin_note ?? null,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
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
