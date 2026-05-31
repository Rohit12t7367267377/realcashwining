import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

// ---------- Deposits ----------

export const listDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.enum(["pending", "approved", "rejected", "all"]).default("pending") }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      note: z.string().max(300).optional(),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: req, error: rerr } = await supabaseAdmin.from("deposit_requests").select("*").eq("id", data.id).single();
    if (rerr) throw new Error(rerr.message);
    if (req.status !== "pending") throw new Error(`Already ${req.status}`);

    if (data.action === "approve") {
      const { data: prof } = await supabaseAdmin.from("profiles").select("wallet_balance").eq("id", req.user_id).single();
      const newBal = Number(prof?.wallet_balance ?? 0) + Number(req.amount);
      const { error: uerr } = await supabaseAdmin.from("profiles").update({ wallet_balance: newBal }).eq("id", req.user_id);
      if (uerr) throw new Error(uerr.message);
      await supabaseAdmin.from("transactions").insert({
        user_id: req.user_id,
        type: "credit",
        amount: Number(req.amount),
        note: `Deposit approved (UTR ${req.upi_utr})`,
      });
    }

    const { error: upErr } = await supabaseAdmin
      .from("deposit_requests")
      .update({
        status: data.action === "approve" ? "approved" : "rejected",
        admin_note: data.note ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });

// ---------- Withdrawals ----------

export const listWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ status: z.enum(["pending", "approved", "paid", "rejected", "all"]).default("pending") }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["mark_paid", "reject"]),
      payout_ref: z.string().max(100).optional(),
      note: z.string().max(300).optional(),
    }).parse(d)
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const { data: req, error: rerr } = await supabaseAdmin.from("withdrawal_requests").select("*").eq("id", data.id).single();
    if (rerr) throw new Error(rerr.message);
    if (req.status !== "pending" && req.status !== "approved") throw new Error(`Already ${req.status}`);

    if (data.action === "reject") {
      // refund the held amount
      const { data: prof } = await supabaseAdmin.from("profiles").select("wallet_balance").eq("id", req.user_id).single();
      const newBal = Number(prof?.wallet_balance ?? 0) + Number(req.amount);
      await supabaseAdmin.from("profiles").update({ wallet_balance: newBal }).eq("id", req.user_id);
      await supabaseAdmin.from("transactions").insert({
        user_id: req.user_id,
        type: "credit",
        amount: Number(req.amount),
        note: `Withdrawal rejected — refund`,
      });
    }

    const { error: upErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({
        status: data.action === "mark_paid" ? "paid" : "rejected",
        payout_ref: data.payout_ref ?? null,
        admin_note: data.note ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });
