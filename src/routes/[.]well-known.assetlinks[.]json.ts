import { createFileRoute } from "@tanstack/react-router";

/**
 * Digital Asset Links for the Android app (Trusted Web Activity).
 * Served from a route so it works even if the host skips dot-folders
 * in the static public/ directory.
 */
const ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "live.gurug.twa",
      sha256_cert_fingerprints: [
        "8D:FF:DC:D9:98:92:B7:41:9B:C4:4C:00:E9:F6:44:73:4D:70:8F:7B:7F:09:D7:91:73:91:6D:81:8A:1C:1C:17",
      ],
    },
  },
];

export const Route = createFileRoute("/.well-known/assetlinks.json")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(ASSET_LINKS), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300",
          },
        }),
    },
  },
});
