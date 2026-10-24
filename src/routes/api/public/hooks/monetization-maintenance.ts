import { createFileRoute } from "@tanstack/react-router";

/** Cron endpoint (daily or hourly): expires plans and free credits. Enforcement is also lazy per request, so this is only cleanup. Idempotent.
 */
export const Route = createFileRoute("/api/public/hooks/monetization-maintenance")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
        const secret = process.env["AUTOMATION_CRON_SECRET"];
        if (!secret) return json({ error: "Automation secret not configured" }, 503);
        const provided =
          request.headers.get("x-automation-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (provided !== secret) return json({ error: "Unauthorized" }, 401);
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await (supabaseAdmin as any).rpc("monetization_maintenance");
          if (error) throw new Error(error.message);
          return json({ ok: true, ...data });
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "Run failed" }, 500);
        }
      },
    },
  },
});
