import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";

// Refreshes cricket_matches from the configured provider (CricAPI-compatible).
// Admin-only; call from /admin/cricket "Refresh now" button.
export const refreshCricketMatches = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { refreshSportsMatches } = await import("@/lib/sports.server");
    return refreshSportsMatches();
  });
