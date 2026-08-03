import { createFileRoute, redirect } from "@tanstack/react-router";

// AI features now live in one place: the AI Hub.
export const Route = createFileRoute("/ai-tutor")({
  beforeLoad: () => {
    throw redirect({ to: "/ai" });
  },
});
