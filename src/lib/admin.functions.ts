import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    return { isAdmin: true };
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
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), amount: z.number(), note: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { data: prof, error: perr } = await supabaseAdmin.from("profiles").select("wallet_balance").eq("id", data.userId).single();
    if (perr) throw new Error(perr.message);
    const newBal = Number(prof.wallet_balance) + data.amount;
    const { error: uerr } = await supabaseAdmin.from("profiles").update({ wallet_balance: newBal }).eq("id", data.userId);
    if (uerr) throw new Error(uerr.message);
    await supabaseAdmin.from("transactions").insert({
      user_id: data.userId,
      type: data.amount >= 0 ? "credit" : "debit",
      amount: Math.abs(data.amount),
      note: `[admin] ${data.note}`,
    });
    return { ok: true, balance: newBal };
  });

export const toggleBan = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("profiles").update({ banned: data.banned }).eq("id", data.userId);
    if (error) throw new Error(error.message);
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
