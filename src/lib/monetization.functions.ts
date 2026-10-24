import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminPermission } from "@/lib/admin-auth";
import { normalizeSettings } from "@/lib/monetization";

const admin = requireAdminPermission("settings.manage");
const sa = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;

async function audit(actor: string, action: string, target: string, after: unknown) {
  try {
    const A = await sa();
    await A.from("admin_audit_logs").insert({
      actor_id: actor, permission_key: "settings.manage", action: `monetization.${action}`, target_type: "monetization",
      target_id: target, result: "success", after_data: after as never, metadata: {},
    });
  } catch { /* auditing must never block the admin action */ }
}

/* ---------------- Student side ---------------- */

/** Balances, today's usage and the configured upgrade options for the signed-in user. */
export const getMyCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const A = await sa();
    const { data: s } = await A.from("app_settings").select("value").eq("key", "monetization").maybeSingle();
    const settings = normalizeSettings(s?.value);
    if (!settings.enabled) return { enabled: false as const };
    const ensured = await A.rpc("mon_ensure_user", { _user: context.userId });
    if (ensured.error) return { enabled: false as const };
    const now = new Date();
    const [{ data: cred }, { data: feats }, { data: usage }, { data: mem }] = await Promise.all([
      A.from("user_credits").select("free_balance, paid_balance, free_expires_at").eq("user_id", context.userId).maybeSingle(),
      A.from("monetization_features").select("feature_key, label, enabled, credit_cost, free_daily_limit, free_monthly_limit, paid_daily_limit, paid_monthly_limit").order("sort_order"),
      A.from("feature_usage").select("feature_key, period, period_start, used").eq("user_id", context.userId).gte("period_start", new Date(now.getTime() - 40 * 864e5).toISOString().slice(0, 10)),
      A.from("user_memberships").select("ends_at, memberships(name, unlimited_ai)").eq("user_id", context.userId).eq("status", "active").gt("ends_at", now.toISOString()).order("ends_at", { ascending: false }).limit(1),
    ]);
    const ist = new Date(now.getTime() + 5.5 * 3600e3);
    const day = ist.toISOString().slice(0, 10);
    const month = day.slice(0, 7) + "-01";
    const used = (k: string, p: string, start: string) => (usage ?? []).find((u: any) => u.feature_key === k && u.period === p && u.period_start === start)?.used ?? 0;
    const plan = mem?.[0] ? { name: mem[0].memberships?.name ?? "Plan", ends_at: mem[0].ends_at, unlimited: !!mem[0].memberships?.unlimited_ai } : null;
    return {
      enabled: true as const,
      free: cred?.free_balance ?? 0, paid: cred?.paid_balance ?? 0, free_expires_at: cred?.free_expires_at ?? null, plan,
      features: (feats ?? []).map((f: any) => {
        const paid = !!plan;
        return {
          key: f.feature_key, label: f.label, enabled: f.enabled, cost: plan?.unlimited ? 0 : f.credit_cost,
          daily_limit: paid ? f.paid_daily_limit : f.free_daily_limit, monthly_limit: paid ? f.paid_monthly_limit : f.free_monthly_limit,
          used_today: used(f.feature_key, "day", day), used_month: used(f.feature_key, "month", month),
        };
      }),
    };
  });

/** Configurable upgrade options shown when credits or limits run out. */
export const getUpgradeOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const A = await sa();
    const { data: s } = await A.from("app_settings").select("value").eq("key", "monetization").maybeSingle();
    const settings = normalizeSettings(s?.value);
    const nowIso = new Date().toISOString();
    const [{ data: plans }, { data: offers }] = await Promise.all([
      settings.upgrade.show_plans
        ? A.from("memberships").select("id, name, price, duration_days, description, highlight, recommended, credits_per_cycle, unlimited_ai").eq("active", true).order("sort_order")
        : { data: [] },
      settings.upgrade.show_offers
        ? A.from("monetization_offers").select("code, title, description, bonus_credits, discount_percent, ends_at").eq("active", true).or(`starts_at.is.null,starts_at.lte.${nowIso}`).or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        : { data: [] },
    ]);
    return { upgrade: settings.upgrade, plans: plans ?? [], offers: offers ?? [] };
  });

export const claimOfferCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().min(2).max(40) }).parse(d))
  .handler(async ({ context, data }) => {
    const A = await sa();
    const { data: r, error } = await A.rpc("claim_offer", { _user: context.userId, _code: data.code });
    if (error) throw new Error("Could not apply this code right now");
    return r as { ok: boolean; reason?: string; credits?: number; title?: string };
  });

/* ---------------- Admin dashboard ---------------- */

export const adminMonOverview = createServerFn({ method: "GET" })
  .middleware([admin])
  .handler(async () => {
    const A = await sa();
    const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
    const [settings, features, plans, offers, ledger, usage, totals, pay] = await Promise.all([
      A.from("app_settings").select("value").eq("key", "monetization").maybeSingle(),
      A.from("monetization_features").select("*").order("sort_order"),
      A.from("memberships").select("id, name, code, price, duration_days, active, credits_per_cycle, unlimited_ai, sort_order").order("sort_order"),
      A.from("monetization_offers").select("*").order("created_at", { ascending: false }),
      A.from("credit_ledger").select("kind, delta").gte("created_at", since30).limit(20000),
      A.from("feature_usage").select("feature_key, used").eq("period", "day").gte("period_start", since30.slice(0, 10)).limit(20000),
      A.from("user_credits").select("free_balance, paid_balance").limit(50000),
      A.from("subscription_payments").select("amount, status, created_at").gte("created_at", since30).limit(5000),
    ]);
    if (features.error) throw new Error("Monetization tables are missing. Run RUN_MONETIZATION_IN_SUPABASE.sql in Supabase first.");
    const sum = (rows: any[] | null, pick: (r: any) => boolean, val: (r: any) => number) => (rows ?? []).filter(pick).reduce((a, r) => a + val(r), 0);
    const byFeature: Record<string, number> = {};
    for (const u of usage.data ?? []) byFeature[u.feature_key] = (byFeature[u.feature_key] ?? 0) + u.used;
    return {
      settings: normalizeSettings(settings.data?.value),
      features: features.data ?? [], plans: plans.data ?? [], offers: offers.data ?? [],
      stats: {
        accounts: (totals.data ?? []).length,
        free_outstanding: sum(totals.data, () => true, (r) => r.free_balance),
        paid_outstanding: sum(totals.data, () => true, (r) => r.paid_balance),
        granted_30d: sum(ledger.data, (r) => r.delta > 0, (r) => r.delta),
        spent_30d: -sum(ledger.data, (r) => r.kind === "usage", (r) => r.delta),
        expired_30d: -sum(ledger.data, (r) => r.kind === "expiry", (r) => r.delta),
        revenue_30d: sum(pay.data, (r) => ["paid", "success", "captured", "completed"].includes(String(r.status)), (r) => Number(r.amount) || 0),
        usage_by_feature: byFeature,
      },
    };
  });

const nn = z.number().int().min(0).max(1_000_000);
const limit = z.number().int().min(0).max(1_000_000).nullable();

export const adminMonSaveSettings = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator((d) =>
    z.object({
      enabled: z.boolean(), signup_credits: nn, signup_credit_expiry_days: z.number().int().min(0).max(3650), monthly_free_credits: nn,
      upgrade: z.object({
        title: z.string().trim().min(1).max(120), message: z.string().trim().max(500), cta_label: z.string().trim().min(1).max(40),
        cta_url: z.string().trim().max(200).refine((u) => u.startsWith("/"), "Use an in-app path starting with /"),
        show_plans: z.boolean(), show_offers: z.boolean(),
      }),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const A = await sa();
    const { error } = await A.from("app_settings").upsert({ key: "monetization", value: data }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    await audit(context.adminUserId, "settings", "monetization", data);
    return { ok: true };
  });

export const adminMonSaveFeature = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator((d) =>
    z.object({
      feature_key: z.string().trim().min(2).max(50).regex(/^[a-z0-9_]+$/), label: z.string().trim().min(1).max(80), description: z.string().trim().max(300).nullable().optional(),
      enabled: z.boolean(), credit_cost: nn, free_daily_limit: limit, free_monthly_limit: limit, paid_daily_limit: limit, paid_monthly_limit: limit,
      sort_order: z.number().int().min(0).max(999).default(0),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const A = await sa();
    const { error } = await A.from("monetization_features").upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "feature_key" });
    if (error) throw new Error(error.message);
    await audit(context.adminUserId, "feature", data.feature_key, data);
    return { ok: true };
  });

export const adminMonSavePlan = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator((d) => z.object({ id: z.string().uuid(), credits_per_cycle: nn, unlimited_ai: z.boolean(), active: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const A = await sa();
    const { id, ...patch } = data;
    const { error } = await A.from("memberships").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    await audit(context.adminUserId, "plan", id, patch);
    return { ok: true };
  });

export const adminMonSaveOffer = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(), code: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/), title: z.string().trim().min(1).max(100),
      description: z.string().trim().max(300).nullable().optional(), bonus_credits: nn, plan_id: z.string().uuid().nullable().optional(),
      discount_percent: z.number().int().min(1).max(100).nullable().optional(), starts_at: z.string().nullable().optional(), ends_at: z.string().nullable().optional(),
      max_redemptions: z.number().int().min(1).nullable().optional(), active: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const A = await sa();
    const { id, ...v } = data;
    const q = id ? A.from("monetization_offers").update(v).eq("id", id) : A.from("monetization_offers").insert(v);
    const { error } = await q;
    if (error) throw new Error(error.message.includes("duplicate") ? "That code already exists" : error.message);
    await audit(context.adminUserId, "offer", v.code, v);
    return { ok: true };
  });

export const adminMonDeleteOffer = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const A = await sa();
    const { error } = await A.from("monetization_offers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.adminUserId, "offer_delete", data.id, {});
    return { ok: true };
  });

export const adminMonSearchUsers = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const A = await sa();
    const term = data.q.replace(/[%,()]/g, " ");
    const { data: rows } = await A.from("profiles").select("id, full_name, username, phone").or(`full_name.ilike.%${term}%,username.ilike.%${term}%,phone.ilike.%${term}%`).limit(15);
    const ids = (rows ?? []).map((r: any) => r.id);
    const { data: cr } = ids.length ? await A.from("user_credits").select("user_id, free_balance, paid_balance").in("user_id", ids) : { data: [] };
    return (rows ?? []).map((r: any) => {
      const c = (cr ?? []).find((x: any) => x.user_id === r.id);
      return { ...r, free: c?.free_balance ?? 0, paid: c?.paid_balance ?? 0 };
    });
  });

/** Credits are assigned to a chosen user or to a whole audience, never by editing a user's settings. */
export const adminMonGrant = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator((d) =>
    z.object({
      target: z.union([z.object({ user_id: z.string().uuid() }), z.object({ audience: z.enum(["all", "free", "subscribers"]) })]),
      amount: z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, "Amount cannot be 0"),
      bucket: z.enum(["free", "paid"]).default("paid"), note: z.string().trim().max(200).default("Admin adjustment"),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const A = await sa();
    if ("user_id" in data.target) {
      const { data: r, error } = await A.rpc("mon_grant", { _user: data.target.user_id, _amount: data.amount, _bucket: data.bucket, _note: data.note, _by: context.adminUserId });
      if (error) throw new Error(error.message);
      await audit(context.adminUserId, "grant_user", data.target.user_id, data);
      return { affected: 1, balances: r };
    }
    const { data: n, error } = await A.rpc("mon_grant_audience", { _audience: data.target.audience, _amount: data.amount, _bucket: data.bucket, _note: data.note, _by: context.adminUserId });
    if (error) throw new Error(error.message);
    await audit(context.adminUserId, "grant_audience", data.target.audience, data);
    return { affected: Number(n) || 0, balances: null };
  });

export const adminMonLedger = createServerFn({ method: "POST" })
  .middleware([admin])
  .inputValidator((d) => z.object({ kind: z.string().max(20).optional(), user_id: z.string().uuid().optional(), limit: z.number().int().min(1).max(200).default(60) }).parse(d))
  .handler(async ({ data }) => {
    const A = await sa();
    let q = A.from("credit_ledger").select("id, user_id, delta, bucket, kind, feature_key, note, created_at, free_after, paid_after").order("created_at", { ascending: false }).limit(data.limit);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))] as string[];
    const { data: pr } = ids.length ? await A.from("profiles").select("id, full_name, username").in("id", ids) : { data: [] };
    const { data: pays } = await A.from("subscription_payments").select("id, user_id, amount, status, provider, created_at, memberships(name)").order("created_at", { ascending: false }).limit(40);
    const name = (id: string) => { const p = (pr ?? []).find((x: any) => x.id === id); return p?.full_name || p?.username || id.slice(0, 8); };
    return {
      ledger: (rows ?? []).map((r: any) => ({ ...r, user: name(r.user_id) })),
      payments: (pays ?? []).map((p: any) => ({ id: p.id, user_id: p.user_id, amount: p.amount, status: p.status, provider: p.provider, created_at: p.created_at, plan: p.memberships?.name ?? null })),
    };
  });

export const adminMonRunMaintenance = createServerFn({ method: "POST" })
  .middleware([admin])
  .handler(async ({ context }) => {
    const A = await sa();
    const { data, error } = await A.rpc("monetization_maintenance");
    if (error) throw new Error(error.message);
    await audit(context.adminUserId, "maintenance", "run", data);
    return data as { expired_memberships: number; expired_credit_accounts: number };
  });
