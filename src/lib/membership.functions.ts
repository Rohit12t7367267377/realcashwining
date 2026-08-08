import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public: the Razorpay key id used by the checkout script (publishable). */
export const getPaymentConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { razorpayKeyId } = await import("@/lib/membership.server");
  const key = razorpayKeyId();
  return { provider: "razorpay" as const, keyId: key, enabled: Boolean(key) };
});

/** Current user's subscription + the feature codes it unlocks. */
export const getMyMembership = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("user_memberships")
      .select("id, membership_id, starts_at, ends_at, status, source")
      .eq("user_id", userId)
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return { active: false as const, plan: null, features: [] as string[], ends_at: null, history: await history(supabase, userId) };

    const { data: plan } = await supabase
      .from("memberships")
      .select("id, code, name, description, price, duration_days, highlight, daily_quiz_limit")
      .eq("id", sub.membership_id)
      .maybeSingle();

    const { data: links } = await supabase
      .from("membership_features")
      .select("feature_id")
      .eq("membership_id", sub.membership_id);
    const ids = (links ?? []).map((l) => l.feature_id);
    let features: string[] = [];
    if (ids.length) {
      const { data: feats } = await supabase.from("premium_features").select("code").in("id", ids).eq("active", true);
      features = (feats ?? []).map((f) => f.code);
    }

    return {
      active: true as const,
      plan,
      features,
      ends_at: sub.ends_at,
      source: sub.source,
      history: await history(supabase, userId),
    };
  });

type Client = { from: (t: string) => any };
async function history(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("subscription_payments")
    .select("id, amount, status, created_at, membership_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as Array<{ id: string; amount: number; status: string; created_at: string; membership_id: string | null }>;
}

/** Step 1 of checkout: create a Razorpay order for a plan. */
export const createSubscriptionOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ membership_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase
      .from("memberships")
      .select("id, name, price, active")
      .eq("id", data.membership_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan not found");
    if (!plan.active) throw new Error("This plan is not available right now");
    const amount = Number(plan.price);
    if (!(amount > 0)) throw new Error("This plan has no price set. Please contact support.");

    const { createRazorpayOrder } = await import("@/lib/membership.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("subscription_payments")
      .insert({ user_id: userId, membership_id: plan.id, amount, status: "created" })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not start payment");

    const order = await createRazorpayOrder({
      amountPaise: Math.round(amount * 100),
      receipt: row.id,
      notes: { payment_row: row.id, user_id: userId, plan: plan.name },
    });

    await supabaseAdmin.from("subscription_payments").update({ order_id: order.id }).eq("id", row.id);

    return { payment_row: row.id, order_id: order.id, amount_paise: order.amount, currency: order.currency, plan_name: plan.name };
  });

/** Step 2 of checkout: verify the signature and activate the subscription. */
export const verifySubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        payment_row: z.string().uuid(),
        razorpay_order_id: z.string().min(4).max(120),
        razorpay_payment_id: z.string().min(4).max(120),
        razorpay_signature: z.string().min(10).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { verifyCheckoutSignature, activateSubscription } = await import("@/lib/membership.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("subscription_payments")
      .select("id, user_id, order_id")
      .eq("id", data.payment_row)
      .maybeSingle();
    if (!row || row.user_id !== userId) throw new Error("Payment not found");
    if (row.order_id !== data.razorpay_order_id) throw new Error("Order mismatch");

    if (!verifyCheckoutSignature(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature)) {
      await supabaseAdmin.from("subscription_payments").update({ status: "failed" }).eq("id", row.id);
      throw new Error("Payment could not be verified");
    }

    const result = await activateSubscription({ paymentRowId: row.id, paymentId: data.razorpay_payment_id });
    return { ok: true, ends_at: result.already ? null : result.ends_at };
  });

/** Wallet-balance fallback purchase (kept for users who already topped up). */
export const subscribeWithWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ membership_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan } = await supabase
      .from("memberships")
      .select("id, name, price, duration_days, active")
      .eq("id", data.membership_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan not found");
    if (!plan.active) throw new Error("This plan is not available right now");

    const { data: prof } = await supabase.from("profiles").select("wallet_balance").eq("id", userId).maybeSingle();
    const balance = Number(prof?.wallet_balance ?? 0);
    if (balance < Number(plan.price)) throw new Error("Insufficient wallet balance. Add money or pay online.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { grantMembership } = await import("@/lib/membership.server");

    await supabaseAdmin.from("profiles").update({ wallet_balance: balance - Number(plan.price) }).eq("id", userId);
    await supabaseAdmin.from("transactions").insert({ user_id: userId, type: "debit", amount: plan.price, note: `Premium: ${plan.name}` });
    const { data: payRow } = await supabaseAdmin
      .from("subscription_payments")
      .insert({ user_id: userId, membership_id: plan.id, amount: plan.price, provider: "wallet", status: "paid" })
      .select("id")
      .single();

    const ends = await grantMembership({
      userId,
      planId: plan.id,
      planName: plan.name,
      durationDays: plan.duration_days,
      source: "paid",
      paymentRowId: payRow?.id ?? null,
    });
    return { ok: true, ends_at: ends };
  });
