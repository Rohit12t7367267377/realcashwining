import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const missionSchema = z.object({
  code: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  kind: z.enum(["daily", "weekly", "monthly"]),
  goal_type: z.enum(["play_quiz", "win_contest", "correct_answers", "xp_gain", "deposit"]),
  goal_value: z.number().int().min(1),
  reward_xp: z.number().int().min(0),
  reward_coins: z.number().min(0),
  reward_box_tier: z.enum(["common", "rare", "epic", "legendary"]).nullable().optional(),
  active: z.boolean(),
  sort_order: z.number().int().default(0),
});

export const adminListMissions = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { data, error } = await supabaseAdmin.from("missions").select("*").order("kind").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertMission = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), values: missionSchema }).parse(d))
  .handler(async ({ data }) => {
    const values = {
      ...data.values,
      description: data.values.description ?? null,
      reward_box_tier: data.values.reward_box_tier ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("missions").update(values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("missions").insert(values);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteMission = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("missions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const eventSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullable().optional(),
  banner_url: z.string().url().nullable().optional().or(z.literal("").transform(() => null)),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  reward_pool: z.number().min(0),
  bonus_xp_multiplier: z.number().min(0.1).max(10),
  active: z.boolean(),
});

export const adminListEvents = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { data, error } = await supabaseAdmin.from("seasonal_events").select("*").order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid().optional(), values: eventSchema }).parse(d))
  .handler(async ({ data }) => {
    const values = {
      ...data.values,
      description: data.values.description ?? null,
      banner_url: data.values.banner_url ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("seasonal_events").update(values).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("seasonal_events").insert(values);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("seasonal_events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGrantXp = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({
      user_id: z.string().uuid(),
      amount: z.number().int(),
      note: z.string().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("grant_xp", {
      _user_id: data.user_id,
      _amount: data.amount,
      _source: `admin:${data.note}`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminXpTopUsers = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("user_xp")
      .select("user_id, xp, level, boxes_earned, updated_at")
      .order("xp", { ascending: false })
      .limit(100);
    const ids = (data ?? []).map((r) => r.user_id);
    let profiles: Record<string, { full_name: string | null; phone: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", ids);
      profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    }
    return (data ?? []).map((r) => ({
      ...r,
      full_name: profiles[r.user_id]?.full_name ?? null,
      phone: profiles[r.user_id]?.phone ?? null,
    }));
  });
