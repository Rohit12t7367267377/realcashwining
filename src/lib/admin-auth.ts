import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side admin guard.
 * Requires a valid Supabase session (bearer token) AND the `admin` role
 * in public.user_roles, verified in the database via has_role().
 * There is no shared password and no frontend-only check.
 */
export const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error("Unauthorized: could not verify admin role");
    if (data !== true) throw new Error("Unauthorized: admin role required");
    return next();
  });

/** Legacy alias kept so existing admin server functions keep working. */
export const requireAdminPassword = requireAdmin;
