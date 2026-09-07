import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Server-side admin guard.
 * Requires a valid Supabase session (bearer token attached by attachSupabaseAuth)
 * AND the `admin` role in public.user_roles, verified in the database through
 * the security-definer has_role() function.
 * No shared password, no frontend-only check.
 */
export const requireAdmin = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const authHeader = request?.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: please sign in");
    }
    const token = authHeader.slice(7).trim();
    if (!token) throw new Error("Unauthorized: please sign in");

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Backend is not configured");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data: claimsData, error: claimsError } = await sb.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (claimsError || !userId) throw new Error("Unauthorized: invalid session");

    const { data: isAdmin, error } = await sb.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (error) throw new Error("Unauthorized: could not verify admin role");
    if (isAdmin !== true) throw new Error("Unauthorized: admin role required");

    return next();
  },
);

/** Legacy alias so existing admin server functions keep working unchanged. */
export const requireAdminPassword = requireAdmin;
