import { createFileRoute, redirect } from "@tanstack/react-router";

// Hall of Fame now lives in the Ranks (competition) centre.
export const Route = createFileRoute("/hall-of-fame")({
  beforeLoad: () => {
    throw redirect({ to: "/leaderboard" });
  },
});
