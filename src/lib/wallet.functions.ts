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
      supabase.from("app_settings").select("key, value").in("key", ["admin_upi_id", "admin_upi_qr", "min_deposit", "max_deposit", "min_withdrawal", "max_withdrawal_per_day"]),
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
        admin_upi_qr: cfg.admin_upi_qr ? String(cfg.admin_upi_qr) : "",
        min_deposit: Number(cfg.min_deposit ?? 20),
        max_deposit: Number(cfg.max_deposit ?? 5000),
        min_withdrawal: Number(cfg.min_withdrawal ?? 100),
        max_withdrawal_per_day: Number(cfg.max_withdrawal_per_day ?? 5000),
      },
    };
  });

// ---------- Write: submit a deposit request ----------

const depositSchema = z.object({
  amount: z.number().min(1).max(5000),
  upi_utr: z.string().trim().min(6).max(50).regex(/^[A-Za-z0-9]+$/, "UTR must be alphanumeric"),
  payer_upi: z.string().trim().max(100).optional().nullable(),
  screenshot_url: z.string().url().max(500).optional().nullable(),
});

export const submitDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => depositSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;

    const { data: cfgRows } = await supabaseAdmin.from("app_settings").select("key, value").in("key", ["min_deposit", "max_deposit"]);
    const cfgMap: Record<string, any> = {};
    (cfgRows ?? []).forEach((r) => { cfgMap[r.key] = r.value; });
    const min = Number(cfgMap.min_deposit ?? 20);
    const max = Number(cfgMap.max_deposit ?? 5000);
    if (data.amount < min) throw new Error(`Minimum deposit is ₹${min}`);
    if (data.amount > max) throw new Error(`Maximum deposit is ₹${max}`);

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
    const { data: result, error } = await (supabaseAdmin as any).rpc("submit_withdrawal_atomic", {
      _user_id: userId, _amount: data.amount, _upi_id: data.upi_id,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(result) ? result[0] : result;
    return { ok: true, withdrawal: { id: row?.request_id }, newBalance: Number(row?.new_balance ?? 0) };
  });

// ---------- Read: full transaction history ----------

export const getTransactionHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: txns }, { data: deposits }, { data: withdrawals }] = await Promise.all([
      supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabase.from("deposit_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supabase.from("withdrawal_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
    ]);

    return {
      txns: txns ?? [],
      deposits: deposits ?? [],
      withdrawals: withdrawals ?? [],
    };
  });
