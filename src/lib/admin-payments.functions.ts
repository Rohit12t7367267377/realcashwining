import { createServerFn } from "@tanstack/react-start";
import { requireAdminPermission } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// ---------- Deposits ----------

export const listDeposits = createServerFn({ method: "GET" })
  .middleware([requireAdminPermission("finance.view")])
  .inputValidator((d) => z.object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") }).parse(d))
  .handler(async ({ data }) => {
    
    let q = supabaseAdmin
      .from("deposit_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // attach profile names
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, phone, wallet_balance").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const reviewDeposit = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission("finance.adjust")])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      note: z.string().trim().min(3).max(300),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await (supabaseAdmin as any).rpc("admin_review_deposit_atomic", {
      _actor_id: context.adminUserId, _request_id: data.id, _action: data.action, _reason: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Withdrawals ----------

export const listWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireAdminPermission("finance.view")])
  .inputValidator((d) => z.object({ status: z.enum(["pending", "approved", "paid", "rejected", "all"]).default("pending") }).parse(d))
  .handler(async ({ data }) => {
    
    let q = supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, phone, wallet_balance").in("id", ids)
      : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({ ...r, profile: map.get(r.user_id) ?? null }));
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission("finance.adjust")])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["mark_paid", "reject"]),
      payout_ref: z.string().max(100).optional(),
      note: z.string().trim().min(3).max(300),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { error } = await (supabaseAdmin as any).rpc("admin_review_withdrawal_atomic", {
      _actor_id: context.adminUserId, _request_id: data.id, _action: data.action,
      _payout_ref: data.payout_ref ?? null, _reason: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
