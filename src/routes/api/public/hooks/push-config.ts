import { createFileRoute } from "@tanstack/react-router";

/** Public web-push config for the service worker (publishable Firebase values only). */
export const Route = createFileRoute("/api/public/hooks/push-config")({
  server: {
    handlers: {
      GET: async () => {
        const { getWebPushConfig } = await import("@/lib/push.server");
        const cfg = getWebPushConfig();
        return Response.json({
          apiKey: cfg.apiKey,
          projectId: cfg.projectId,
          messagingSenderId: cfg.messagingSenderId,
          appId: cfg.appId,
        });
      },
    },
  },
});
