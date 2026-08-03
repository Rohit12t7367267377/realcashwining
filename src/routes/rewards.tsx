import { createFileRoute, redirect } from "@tanstack/react-router";

// Rewards are now part of the Elite Hub.
export const Route = createFileRoute("/rewards")({
  beforeLoad: () => {
    throw redirect({ to: "/hub" });
  },
});
