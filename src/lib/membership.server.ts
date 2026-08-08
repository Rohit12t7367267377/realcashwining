import { createHmac, timingSafeEqual } from "crypto";

/** Razorpay REST helpers + subscription activation. Server-only. */

function credentials() {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) throw new Error("Payments are not configured yet. Please try again later.");
  return { keyId, keySecret };
}

export function razorpayKeyId(): string | null {
  return process.env["RAZORPAY_KEY_ID"] ?? null;
}

export async function createRazorpayOrder(args: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}) {
  const { keyId, keySecret } = credentials();
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: args.amountPaise,
      currency: "INR",
      receipt: args.receipt,
      notes: args.notes,
      payment_capture: 1,
    }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json?.["error"] as { description?: string } | undefined;
    throw new Error(err?.description ?? `Razorpay order failed (${res.status})`);
  }
  return json as { id: string; amount: number; currency: string };
}

/** Verifies checkout handler signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const { keySecret } = credentials();
  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqual(signature, expected);
}

/** Verifies a webhook body against RAZORPAY_WEBHOOK_SECRET. */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqual(signature, expected);
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Activates (or extends) a user's subscription. Idempotent per payment row:
 * if the payment is already marked paid, nothing happens twice.
 */
export async function activateSubscription(args: {
  paymentRowId: string;
  paymentId?: string | null;
  raw?: unknown;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pay } = await supabaseAdmin
    .from("subscription_payments")
    .select("id, user_id, membership_id, amount, status")
    .eq("id", args.paymentRowId)
    .maybeSingle();
  if (!pay) throw new Error("Payment record not found");
  if (pay.status === "paid") return { already: true as const };
  if (!pay.membership_id) throw new Error("Payment has no plan attached");

  const { data: plan } = await supabaseAdmin
    .from("memberships")
    .select("id, name, duration_days")
    .eq("id", pay.membership_id)
    .maybeSingle();
  if (!plan) throw new Error("Plan not found");

  await supabaseAdmin
    .from("subscription_payments")
    .update({ status: "paid", payment_id: args.paymentId ?? null, raw: (args.raw ?? null) as never })
    .eq("id", pay.id);

  const ends = await grantMembership({
    userId: pay.user_id,
    planId: plan.id,
    planName: plan.name,
    durationDays: plan.duration_days,
    source: "paid",
    paymentRowId: pay.id,
  });

  return { already: false as const, ends_at: ends };
}

/** Creates/extends an active subscription row and returns the new end date. */
export async function grantMembership(args: {
  userId: string;
  planId: string;
  planName: string;
  durationDays: number;
  source: "paid" | "admin" | "gift";
  paymentRowId?: string | null;
  adminNote?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = Date.now();

  const { data: current } = await supabaseAdmin
    .from("user_memberships")
    .select("id, ends_at")
    .eq("user_id", args.userId)
    .eq("status", "active")
    .gt("ends_at", new Date(now).toISOString())
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const base = current?.ends_at ? new Date(current.ends_at).getTime() : now;
  const endsAt = new Date(base + args.durationDays * 86400_000).toISOString();

  if (current) {
    await supabaseAdmin
      .from("user_memberships")
      .update({ membership_id: args.planId, ends_at: endsAt, status: "active", source: args.source, admin_note: args.adminNote ?? null })
      .eq("id", current.id);
  } else {
    await supabaseAdmin.from("user_memberships").insert({
      user_id: args.userId,
      membership_id: args.planId,
      starts_at: new Date(now).toISOString(),
      ends_at: endsAt,
      status: "active",
      source: args.source,
      admin_note: args.adminNote ?? null,
      payment_id: args.paymentRowId ?? null,
    });
  }

  return endsAt;
}
