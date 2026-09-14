import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export type AdminContext = {
  adminUserId: string;
  adminRoles: string[];
  adminPermissions: string[];
};

async function resolveAdminContext(token: string): Promise<AdminContext> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) throw new Error("Backend is not configured");

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: claimsData, error: claimsError } = await sb.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) throw new Error("Unauthorized: invalid session");

  const { data: isAdmin, error } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Unauthorized: could not verify administrator access");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: assignments } = await (supabaseAdmin as any)
    .from("admin_user_role_assignments")
    .select("admin_role_definitions(name, active, admin_role_permissions(permission_key))")
    .eq("user_id", userId);
  const roles = new Set<string>();
  const permissions = new Set<string>();
  if (isAdmin === true) {
    roles.add("admin");
    permissions.add("*");
  }
  for (const assignment of assignments ?? []) {
    const role = assignment.admin_role_definitions;
    if (!role?.active) continue;
    roles.add(role.name);
    for (const item of role.admin_role_permissions ?? []) permissions.add(item.permission_key);
  }
  if (roles.size === 0) throw new Error("Forbidden: administrator access required");
  return { adminUserId: userId, adminRoles: [...roles], adminPermissions: [...permissions] };
}

async function authenticatedAdminContext(): Promise<AdminContext> {
  const request = getRequest();
  const authHeader = request?.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized: please sign in");
  const token = authHeader.slice(7).trim();
  if (!token) throw new Error("Unauthorized: please sign in");
  return resolveAdminContext(token);
}

/**
 * Server-side admin guard.
 * Requires a valid Supabase session (bearer token attached by attachSupabaseAuth)
 * AND the `admin` role in public.user_roles, verified in the database through
 * the security-definer has_role() function.
 * No shared password, no frontend-only check.
 */
export const requireAdmin = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const admin = await authenticatedAdminContext();
    return next({ context: admin });
  },
);

export function requireAdminPermission(permission: string) {
  return createMiddleware({ type: "function" }).server(async ({ next }) => {
    const admin = await authenticatedAdminContext();
    if (!admin.adminPermissions.includes("*") && !admin.adminPermissions.includes(permission)) {
      throw new Error(`Forbidden: ${permission} permission required`);
    }
    return next({ context: admin });
  });
}

/** Legacy alias so existing admin server functions keep working unchanged. */
export const requireAdminPassword = requireAdmin;
