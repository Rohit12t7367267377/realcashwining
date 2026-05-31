import { createFileRoute, redirect } from "@tanstack/react-router";

// The OTP login was a demo. Real auth lives at /auth (Google + email/password).
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
