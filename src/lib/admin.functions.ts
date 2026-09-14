import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword, requireAdminPermission } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async ({ context }) => {
    return { isAdmin: true, roles: context.adminRoles, permissions: context.adminPermissions };
  });

export const listUsersAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { data: authList, error: aerr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (aerr) throw new Error(aerr.message);
    const { data: profiles } = await supabaseAdmin.from("profiles").select("*");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });
    return authList.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      profile: profileMap.get(u.id) ?? null,
      roles: roleMap.get(u.id) ?? [],
    }));
  });

export const adjustWallet = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission("finance.adjust")])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), amount: z.number().finite().refine((v) => v !== 0).refine((v) => Math.abs(v) <= 100000), note: z.string().trim().min(3).max(200), idempotencyKey: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: balance, error } = await (supabaseAdmin as any).rpc("admin_adjust_wallet_atomic", {
      _actor_id: context.adminUserId,
      _user_id: data.userId,
      _amount: data.amount,
      _reason: data.note,
      _idempotency_key: data.idempotencyKey,
    });
    if (error) throw new Error(error.message);
    return { ok: true, balance: Number(balance) };
  });

export const toggleBan = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission("users.ban")])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), banned: z.boolean(), reason: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: before } = await supabaseAdmin.from("profiles").select("banned").eq("id", data.userId).single();
    const { error } = await supabaseAdmin.from("profiles").update({ banned: data.banned }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await (supabaseAdmin as any).rpc("write_admin_audit", {
      _actor_id: context.adminUserId, _permission: "users.ban", _action: data.banned ? "user.ban" : "user.unban",
      _target_type: "profile", _target_id: data.userId, _result: "success", _reason: data.reason,
      _before: { banned: before?.banned ?? false }, _after: { banned: data.banned }, _metadata: {},
    });
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    if (data.makeAdmin) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    }
    return { ok: true };
  });

const ROLE_ENUM = z.enum(["admin", "editor", "moderator", "user"]);

export const setRoleAssignment = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), role: ROLE_ENUM, enabled: z.boolean() }).parse(d)
  )
  .handler(async ({ data }) => {
    if (data.enabled) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
    }
    return { ok: true };
  });
