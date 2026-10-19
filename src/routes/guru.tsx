import { createFileRoute, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { GuruVoiceDock } from "@/components/GuruVoiceDock";
import { GuruBoardDock } from "@/components/GuruBoardDock";

export const Route = createFileRoute("/guru")({
  component: GuruLayout,
});

function GuruLayout() {
  const router = useRouter();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const atGuruHome = pathname.replace(/\/+$/, "") === "/guru";

  // One Back for every Guru.AI page. In-page steps (board → class → subject …) have their own step-back buttons.
  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.history.back();
    else void navigate({ to: "/guru" });
  }

  return (
    <>
      <Outlet />
      {!atGuruHome && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="press fixed bottom-24 left-3 z-40 inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-xs font-bold shadow-lift ring-1 ring-border"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}
      <GuruBoardDock />
      <GuruVoiceDock />
    </>
  );
}
