import { createFileRoute, redirect } from "@tanstack/react-router";

// Missions now live in the Ranks (competition) centre.
export const Route = createFileRoute("/missions")({
  beforeLoad: () => {
    throw redirect({ to: "/leaderboard" });
  },
});
