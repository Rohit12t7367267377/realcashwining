import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyXp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("user_xp").select("*").eq("user_id", userId).maybeSingle();
    const xp = Number(data?.xp ?? 0);
    const level = Number(data?.level ?? 1);
    // XP needed for next level: level = floor(sqrt(xp/100))+1, so nextThreshold = level^2 * 100
    const currentFloor = Math.pow(level - 1, 2) * 100;
    const nextFloor = Math.pow(level, 2) * 100;
    const progress = Math.max(0, Math.min(1, (xp - currentFloor) / Math.max(1, nextFloor - currentFloor)));
    const rankTitle =
      level >= 50 ? "Legend" :
      level >= 30 ? "Grandmaster" :
      level >= 20 ? "Master" :
      level >= 15 ? "Diamond" :
      level >= 10 ? "Platinum" :
      level >= 6  ? "Gold" :
      level >= 3  ? "Silver" : "Bronze";
    return { xp, level, currentFloor, nextFloor, progress, rankTitle, boxesEarned: Number(data?.boxes_earned ?? 0) };
  });

export const listMyMissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Refresh progress first
    await supabase.rpc("refresh_user_missions", { _user_id: userId });
    const { data: missions } = await supabase
      .from("missions")
      .select("*")
      .eq("active", true)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true });
    const { data: progress } = await supabase
      .from("user_missions")
      .select("*")
      .eq("user_id", userId);
    const map = new Map((progress ?? []).map((p) => [p.mission_id, p]));
    return (missions ?? []).map((m) => {
      const p = map.get(m.id);
      return {
        ...m,
        progress: Number(p?.progress ?? 0),
        completed_at: p?.completed_at ?? null,
        claimed_at: p?.claimed_at ?? null,
        user_mission_id: p?.id ?? null,
      };
    });
  });

export const claimMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_mission_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("claim_mission", { _user_mission_id: data.user_mission_id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyRewardBoxes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("reward_boxes")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return data ?? [];
  });

export const openRewardBox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ box_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: res, error } = await context.supabase.rpc("open_reward_box", { _box_id: data.box_id });
    if (error) throw new Error(error.message);
    const row = Array.isArray(res) ? res[0] : res;
    return { xp: Number(row?.reward_xp ?? 0), coins: Number(row?.reward_coins ?? 0), tier: String(row?.tier ?? "common") };
  });

export const listActiveEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const nowIso = new Date().toISOString();
    const { data } = await context.supabase
      .from("seasonal_events")
      .select("*")
      .eq("active", true)
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso)
      .order("ends_at", { ascending: true });
    return data ?? [];
  });

export const getHallOfFame = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: top } = await context.supabase
      .from("user_xp")
      .select("user_id, xp, level")
      .order("xp", { ascending: false })
      .limit(50);
    const ids = (top ?? []).map((t) => t.user_id);
    let profiles: Record<string, { full_name: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      profiles = Object.fromEntries((profs ?? []).map((p) => [p.id, p]));
    }
    return (top ?? []).map((r, i) => ({
      rank: i + 1,
      user_id: r.user_id,
      xp: Number(r.xp),
      level: Number(r.level),
      name: profiles[r.user_id]?.full_name ?? "Player",
    }));
  });
