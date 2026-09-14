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
  .middleware([requireAdminPermission("users.view")])
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

export const getRoleManagement = createServerFn({ method: "GET" })
  .middleware([requireAdminPermission("roles.manage")])
  .handler(async ({ context }) => {
    const [{ data: authList, error: authError }, { data: profiles }, { data: roles, error: rolesError }, { data: assignments, error: assignmentsError }] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 200 }),
      supabaseAdmin.from("profiles").select("id, full_name, phone"),
      supabaseAdmin.from("admin_role_definitions").select("id, name, label, description, system, active, admin_role_permissions(permission_key)").eq("active", true).order("label"),
      supabaseAdmin.from("admin_user_role_assignments").select("user_id, role_id, assigned_by, created_at"),
    ]);
    if (authError) throw new Error(authError.message);
    if (rolesError) throw new Error(rolesError.message);
    if (assignmentsError) throw new Error(assignmentsError.message);
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const assignmentMap = new Map<string, string[]>();
    for (const assignment of assignments ?? []) {
      const current = assignmentMap.get(assignment.user_id) ?? [];
      current.push(assignment.role_id);
      assignmentMap.set(assignment.user_id, current);
    }
    return {
      actorId: context.adminUserId,
      actorRoles: context.adminRoles,
      roles: (roles ?? []).map((role) => ({
        id: role.id,
        name: role.name,
        label: role.label,
        description: role.description,
        system: role.system,
        permissions: (role.admin_role_permissions ?? []).map((item) => item.permission_key),
      })),
      users: authList.users.map((user) => ({
        id: user.id,
        email: user.email ?? "",
        profile: profileMap.get(user.id) ?? null,
        roleIds: assignmentMap.get(user.id) ?? [],
      })),
    };
  });

export const manageAdminRole = createServerFn({ method: "POST" })
  .middleware([requireAdminPermission("roles.manage")])
  .inputValidator((data) => z.object({
    userId: z.string().uuid(),
    roleId: z.string().uuid(),
    enabled: z.boolean(),
    reason: z.string().trim().min(3).max(300),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await (supabaseAdmin as any).rpc("admin_manage_user_role", {
      _actor_id: context.adminUserId,
      _user_id: data.userId,
      _role_id: data.roleId,
      _enabled: data.enabled,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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

