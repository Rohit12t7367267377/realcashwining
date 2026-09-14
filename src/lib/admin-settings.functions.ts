import { createServerFn } from "@tanstack/react-start";
import { requireAdminPermission } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const ALLOWED_SETTING_KEYS = [
  "admin_upi_id", "admin_upi_qr", "min_deposit", "max_deposit", "min_withdrawal",
  "new_user_bonus", "correct_points", "wrong_points", "prize_pool_pct", "prize_pool_total",
  "branding", "banner", "subscription_config", "community_moderation",
] as const;

const settingKey = z.enum(ALLOWED_SETTING_KEYS);

export const getAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireAdminPermission("settings.manage")])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("key, value, updated_at")
      .in("key", [...ALLOWED_SETTING_KEYS]);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveAppSetting = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission("settings.manage")])
  .inputValidator((d) =>
    z.object({
      key: settingKey,
      value: z.any(),
      reason: z.string().trim().min(3).max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (["min_deposit", "max_deposit", "min_withdrawal", "new_user_bonus", "prize_pool_total"].includes(data.key)) {
      z.number().finite().nonnegative().parse(data.value);
    }
    if (data.key === "prize_pool_pct") z.number().min(0).max(100).parse(data.value);
    if (["correct_points", "wrong_points"].includes(data.key)) z.number().finite().parse(data.value);
    if (data.key === "admin_upi_id") z.string().trim().min(3).max(100).parse(data.value);
    const { data: before } = await supabaseAdmin.from("app_settings").select("value").eq("key", data.key).maybeSingle();
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: data.key, value: data.value, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await (supabaseAdmin as any).rpc("write_admin_audit", {
      _actor_id: context.adminUserId,
      _permission: "settings.manage",
      _action: "setting.update",
      _target_type: "app_setting",
      _target_id: data.key,
      _result: "success",
      _reason: data.reason?.trim() || `Updated ${data.key}`,
      _before: { value: before?.value ?? null },
      _after: { value: data.value },
      _metadata: {},
    });
    return { ok: true };
  });
