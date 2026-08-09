import { createFileRoute } from "@tanstack/react-router";

/** Cron endpoint: sends queued + due scheduled push campaigns. */
export const Route = createFileRoute("/api/public/hooks/push-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["AUTOMATION_CRON_SECRET"];
        if (!secret) {
          return Response.json({ error: "Cron secret not configured" }, { status: 503 });
        }
        const provided =
          request.headers.get("x-automation-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (provided !== secret) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { dispatchDueCampaigns } = await import("@/lib/push-dispatch.server");
        const result = await dispatchDueCampaigns();
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
