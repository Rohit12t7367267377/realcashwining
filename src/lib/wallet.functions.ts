import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// ---------- Read: my wallet, my requests, public settings ----------

export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: txns }, { data: deposits }, { data: withdrawals }, { data: settings }] = await Promise.all([
      supabase.from("profiles").select("wallet_balance, full_name, phone").eq("id", userId).maybeSingle(),
      supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("deposit_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("withdrawal_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("app_settings").select("key, value").in("key", ["admin_upi_id", "min_deposit", "min_withdrawal", "max_withdrawal_per_day"]),
    ]);

    const cfg: Record<string, any> = {};
    (settings ?? []).forEach((s) => { cfg[s.key] = s.value; });

    return {
      balance: Number(profile?.wallet_balance ?? 0),
      fullName: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      txns: txns ?? [],
      deposits: deposits ?? [],
      withdrawals: withdrawals ?? [],
      settings: {
        admin_upi_id: String(cfg.admin_upi_id ?? "admin@upi"),
        min_deposit: Number(cfg.min_deposit ?? 10),
        min_withdrawal: Number(cfg.min_withdrawal ?? 100),
        max_withdrawal_per_day: Number(cfg.max_withdrawal_per_day ?? 5000),
      },
    };
  });

// ---------- Write: submit a deposit request ----------

const depositSchema = z.object({
  amount: z.number().min(1).max(100000),
  upi_utr: z.string().trim().min(6).max(50).regex(/^[A-Za-z0-9]+$/, "UTR must be alphanumeric"),
  payer_upi: z.string().trim().max(100).optional().nullable(),
  screenshot_url: z.string().url().max(500).optional().nullable(),
});

export const submitDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => depositSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;

    const { data: cfg } = await supabaseAdmin.from("app_settings").select("value").eq("key", "min_deposit").maybeSingle();
    const min = Number(cfg?.value ?? 10);
    if (data.amount < min) throw new Error(`Minimum deposit is ₹${min}`);

    // prevent duplicate UTR
    const { data: dup } = await supabaseAdmin
      .from("deposit_requests")
      .select("id")
      .eq("upi_utr", data.upi_utr)
      .maybeSingle();
    if (dup) throw new Error("This UTR has already been submitted.");

    const { data: row, error } = await supabaseAdmin
      .from("deposit_requests")
      .insert({
        user_id: userId,
        amount: data.amount,
        upi_utr: data.upi_utr,
        payer_upi: data.payer_upi ?? null,
        screenshot_url: data.screenshot_url ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, deposit: row };
  });

// ---------- Write: submit a withdrawal request ----------

const withdrawalSchema = z.object({
  amount: z.number().min(1).max(100000),
  upi_id: z.string().trim().min(3).max(100).regex(/^[\w.\-]+@[\w.\-]+$/, "Enter a valid UPI ID like name@bank"),
});

export const submitWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => withdrawalSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;

    const [{ data: cfgRows }, { data: prof }] = await Promise.all([
      supabaseAdmin.from("app_settings").select("key, value").in("key", ["min_withdrawal", "max_withdrawal_per_day"]),
      supabaseAdmin.from("profiles").select("wallet_balance, banned").eq("id", userId).single(),
    ]);
    if (!prof) throw new Error("Profile not found");
    if (prof.banned) throw new Error("Your account is suspended. Contact support.");

    const cfg: Record<string, any> = {};
    (cfgRows ?? []).forEach((s) => { cfg[s.key] = s.value; });
    const min = Number(cfg.min_withdrawal ?? 100);
    const maxDaily = Number(cfg.max_withdrawal_per_day ?? 5000);

    if (data.amount < min) throw new Error(`Minimum withdrawal is ₹${min}`);
    if (Number(prof.wallet_balance) < data.amount) throw new Error("Insufficient balance");

    // daily cap (sum of approved + pending + paid in last 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("amount, status")
      .eq("user_id", userId)
      .gte("created_at", since)
      .in("status", ["pending", "approved", "paid"]);
    const used = (recent ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
    if (used + data.amount > maxDaily) {
      throw new Error(`Daily withdrawal limit ₹${maxDaily} exceeded (already requested ₹${used} today).`);
    }

    // debit wallet immediately (held), refund on rejection
    const newBal = Number(prof.wallet_balance) - data.amount;
    const { error: uerr } = await supabaseAdmin.from("profiles").update({ wallet_balance: newBal }).eq("id", userId);
    if (uerr) throw new Error(uerr.message);

    const { data: row, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .insert({
        user_id: userId,
        amount: data.amount,
        upi_id: data.upi_id,
        status: "pending",
      })
      .select()
      .single();
    if (error) {
      // roll back wallet
      await supabaseAdmin.from("profiles").update({ wallet_balance: Number(prof.wallet_balance) }).eq("id", userId);
      throw new Error(error.message);
    }

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "debit",
      amount: data.amount,
      note: `Withdrawal requested → ${data.upi_id}`,
    });

    return { ok: true, withdrawal: row, newBalance: newBal };
  });
