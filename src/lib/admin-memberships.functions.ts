import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";

/** Admin: full control over plans, benefits, subscribers and revenue. */

export const adminListPlanFeatures = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: features }, { data: links }] = await Promise.all([
      supabaseAdmin.from("premium_features").select("*").order("sort_order"),
      supabaseAdmin.from("membership_features").select("membership_id, feature_id"),
    ]);
    return { features: features ?? [], links: links ?? [] };
  });

export const adminUpsertFeature = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().trim().min(2).max(60).regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers and underscores"),
        name: z.string().trim().min(2).max(80),
        description: z.string().trim().max(300).optional(),
        icon: z.string().trim().max(40).default("sparkles"),
        active: z.boolean().default(true),
        sort_order: z.number().int().min(0).max(999).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...values } = data;
    const q = id
      ? supabaseAdmin.from("premium_features").update(values).eq("id", id)
      : supabaseAdmin.from("premium_features").insert(values);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteFeature = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("premium_features").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Replace the benefit set assigned to a plan. */
export const adminSetPlanFeatures = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({ membership_id: z.string().uuid(), feature_ids: z.array(z.string().uuid()).max(100) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("membership_features").delete().eq("membership_id", data.membership_id);
    if (data.feature_ids.length) {
      const rows = data.feature_ids.map((feature_id) => ({ membership_id: data.membership_id, feature_id }));
      const { error } = await supabaseAdmin.from("membership_features").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: data.feature_ids.length };
  });

/** Subscribers list with plan + user name, newest first. */
export const adminListSubscribers = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ status: z.enum(["active", "expired", "cancelled", "all"]).default("active") }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("user_memberships")
      .select("id, user_id, membership_id, starts_at, ends_at, status, source, admin_note")
      .order("ends_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows } = await q;
    const list = rows ?? [];

    const userIds = [...new Set(list.map((r) => r.user_id))];
    const planIds = [...new Set(list.map((r) => r.membership_id))];
    const [{ data: profs }, { data: plans }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name, phone, username").in("id", userIds)
        : Promise.resolve({ data: [] as never[] }),
      planIds.length
        ? supabaseAdmin.from("memberships").select("id, name, price").in("id", planIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);
    const pm = new Map((profs ?? []).map((p) => [p.id, p]));
    const mm = new Map((plans ?? []).map((p) => [p.id, p]));

    return list.map((r) => ({
      ...r,
      user: pm.get(r.user_id) ?? null,
      plan: mm.get(r.membership_id) ?? null,
      expired: r.ends_at ? new Date(r.ends_at).getTime() < Date.now() : false,
    }));
  });

/** Grant / extend a subscription manually (search by phone, username or name). */
export const adminGrantSubscription = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        query: z.string().trim().min(2).max(80),
        membership_id: z.string().uuid(),
        note: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { grantMembership } = await import("@/lib/membership.server");

    const like = `%${data.query}%`;
    const { data: matches } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, username")
      .or(`phone.ilike.${like},username.ilike.${like},full_name.ilike.${like}`)
      .limit(5);
    if (!matches?.length) throw new Error("No user matched that phone / username / name");
    if (matches.length > 1) throw new Error(`Too many matches (${matches.length}). Be more specific.`);
    const user = matches[0];

    const { data: plan } = await supabaseAdmin
      .from("memberships")
      .select("id, name, duration_days")
      .eq("id", data.membership_id)
      .maybeSingle();
    if (!plan) throw new Error("Plan not found");

    const ends = await grantMembership({
      userId: user.id,
      planId: plan.id,
      planName: plan.name,
      durationDays: plan.duration_days,
      source: "admin",
      adminNote: data.note ?? null,
    });
    return { ok: true, user: user.full_name ?? user.username ?? user.phone, ends_at: ends };
  });

export const adminUpdateSubscription = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["cancel", "reactivate", "extend"]),
        extra_days: z.number().int().min(1).max(3650).optional(),
        note: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_memberships")
      .select("id, ends_at")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Subscription not found");

    const patch: Record<string, unknown> = { admin_note: data.note ?? null };
    if (data.action === "cancel") patch["status"] = "cancelled";
    if (data.action === "reactivate") patch["status"] = "active";
    if (data.action === "extend") {
      const base = Math.max(Date.now(), row.ends_at ? new Date(row.ends_at).getTime() : Date.now());
      patch["ends_at"] = new Date(base + (data.extra_days ?? 30) * 86400_000).toISOString();
      patch["status"] = "active";
    }
    const { error } = await supabaseAdmin.from("user_memberships").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Revenue + subscriber analytics. */
export const adminSubscriptionStats = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [{ data: paid }, { count: activeCount }, { count: expiredCount }, { data: monthPaid }] = await Promise.all([
      supabaseAdmin.from("subscription_payments").select("amount, membership_id").eq("status", "paid"),
      supabaseAdmin
        .from("user_memberships")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gt("ends_at", nowIso),
      supabaseAdmin.from("user_memberships").select("id", { count: "exact", head: true }).lt("ends_at", nowIso),
      supabaseAdmin.from("subscription_payments").select("amount").eq("status", "paid").gte("created_at", monthStart),
    ]);

    const revenue = (paid ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const monthRevenue = (monthPaid ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);

    const byPlan = new Map<string, { count: number; revenue: number }>();
    for (const r of paid ?? []) {
      const key = r.membership_id ?? "unknown";
      const cur = byPlan.get(key) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(r.amount ?? 0);
      byPlan.set(key, cur);
    }
    const { data: plans } = await supabaseAdmin.from("memberships").select("id, name");
    const nameOf = new Map((plans ?? []).map((p) => [p.id, p.name]));

    return {
      revenue,
      monthRevenue,
      payments: (paid ?? []).length,
      active: activeCount ?? 0,
      expired: expiredCount ?? 0,
      byPlan: [...byPlan.entries()].map(([id, v]) => ({ plan: nameOf.get(id) ?? "Unknown", ...v })).sort((a, b) => b.revenue - a.revenue),
    };
  });
