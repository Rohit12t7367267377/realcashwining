import { useEffect } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/guru")({
  component: GuruLayout,
});

/** Every "Teach me" / "AI Teacher" button in School, College, Exams and Skills opens the same Classroom. */
function GuruLayout() {
  const navigate = useNavigate();
  useEffect(() => {
    const onTeach = (e: Event) => {
      const topic = (e as CustomEvent<{ topic?: string }>).detail?.topic?.trim();
      if (topic) void navigate({ to: "/guru/classroom", search: { topic, go: "1" } });
    };
    window.addEventListener("guru:teach", onTeach);
    return () => window.removeEventListener("guru:teach", onTeach);
  }, [navigate]);
  return <Outlet />;
}
