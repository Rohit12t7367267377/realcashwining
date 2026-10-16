import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint for the free-to-play prediction engine.
 * One call performs: fixture sync -> ball events -> contest generation ->
 * lifecycle (publish/lock) -> settlement -> rankings/rewards -> notifications.
 * Idempotent and safe to retry. Protected with the shared automation secret.
 */
export const Route = createFileRoute("/api/public/hooks/pred-tick")({
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
          const { runPredTick } = await import("@/lib/pred/sync.server");
          const result = await runPredTick({ trigger: "cron" });
          return json({ ok: true, ...result });
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "Tick failed" }, 500);
        }
      },
    },
  },
});
