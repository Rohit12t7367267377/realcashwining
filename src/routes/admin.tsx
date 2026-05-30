import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — Cash Winning League" }] }),
});

function AdminLayout() {
  const nav = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "deny">("loading");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        nav({ to: "/auth" });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setState(data ? "ok" : "deny");
    })();
  }, [nav]);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (state === "deny") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-2xl font-bold">Admin only</h1>
        <p className="text-muted-foreground">Your account doesn't have admin access.</p>
        <button onClick={() => nav({ to: "/" })} className="text-primary hover:underline">Go home</button>
      </div>
    );
  }
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
