import { createFileRoute, Outlet } from "@tanstack/react-router";
import { GuruVoiceDock } from "@/components/GuruVoiceDock";

export const Route = createFileRoute("/guru")({
  component: GuruLayout,
});

function GuruLayout() {
  return (
    <>
      <Outlet />
      <GuruVoiceDock />
    </>
  );
}
