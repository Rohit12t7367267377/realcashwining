import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { checkIsAdmin } from "@/lib/admin.functions";
import { useAuthSession } from "@/hooks/use-auth-session";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — Guru-G" }] }),
});

function Gate({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lift space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
          {icon}
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-xs text-muted-foreground">{text}</p>
        {children}
      </div>
    </div>
  );
}

function AdminLayout() {
  const { user, loading } = useAuthSession();
  const verify = useServerFn(checkIsAdmin);
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setState("denied");
      return;
    }
    let cancelled = false;
    setState("checking");
    verify()
      .then(() => !cancelled && setState("ok"))
      .catch(() => !cancelled && setState("denied"));
    return () => {
      cancelled = true;
    };
  }, [loading, user?.id]);

  if (loading || state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "denied" && !user) {
    return (
      <Gate icon={<ShieldCheck className="h-6 w-6" />} title="Admin sign-in required" text="Sign in with your admin account to open the control panel.">
        <Button asChild className="w-full h-12 bg-gradient-primary font-bold">
          <Link to="/auth">Sign in</Link>
        </Button>
      </Gate>
    );
  }

  if (state === "denied") {
    return (
      <Gate icon={<ShieldAlert className="h-6 w-6" />} title="Access denied" text="This account does not have admin permission. Ask an existing admin to grant you the admin role.">
        <Button asChild variant="outline" className="w-full h-12">
          <Link to="/">Back to app</Link>
        </Button>
      </Gate>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
