import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: locks + evaluates finished contests, refreshes leaderboards
 * and (when enabled) distributes prizes. Protected with a shared secret.
 */
export const Route = createFileRoute("/api/public/hooks/automation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["AUTOMATION_CRON_SECRET"];
        if (!secret) {
          return new Response(JSON.stringify({ error: "Automation secret not configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        const provided =
          request.headers.get("x-automation-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (provided !== secret) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { runAutoResults, runAutoLeaderboardPrizes } = await import("@/lib/automation.server");
        const { runSportsAutomation } = await import("@/lib/sports.server");
        const sports = await runSportsAutomation().catch(() => null);
        const results = await runAutoResults();
        const week = await runAutoLeaderboardPrizes("week");
        const month = await runAutoLeaderboardPrizes("month");
        const year = await runAutoLeaderboardPrizes("year");

        return Response.json({ ok: true, sports, results, week, month, year });
      },
    },
  },
});
