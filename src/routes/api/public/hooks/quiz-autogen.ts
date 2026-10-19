import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint for automatic school quiz contests. Call it every few minutes (e.g. every 5-15 min); the
 * configured interval decides when a new contest is actually due, so extra calls are harmless (idempotent).
 * Protected with the shared automation secret.
 */
export const Route = createFileRoute("/api/public/hooks/quiz-autogen")({
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
          const { runQuizAutogen, supabaseQuizAutogenStore, aiQuizGenerator } = await import("@/lib/quiz-autogen.server");
          const result = await runQuizAutogen({ store: supabaseQuizAutogenStore(supabaseAdmin as any), generate: aiQuizGenerator });
          return json({ ok: result.status !== "failed", ...result });
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "Run failed" }, 500);
        }
      },
    },
  },
});
