import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Loader2, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — Cash Winning League" }] }),
});

const ADMIN_PASSWORD = "Zoe@123";
const GATE_KEY = "cwl_admin_gate_v1";

function AdminLayout() {
  const nav = useNavigate();
  const [gateOk, setGateOk] = useState(false);
  const [pw, setPw] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "ok" | "deny">("idle");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(GATE_KEY) === "1") {
      setGateOk(true);
    }
  }, []);

  useEffect(() => {
    if (!gateOk) return;
    (async () => {
      setState("checking");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setState("deny");
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
  }, [gateOk]);

  function submitGate(e: React.FormEvent) {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(GATE_KEY, "1");
      setGateOk(true);
    } else {
      toast.error("Wrong password");
      setPw("");
    }
  }

  if (!gateOk) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <form onSubmit={submitGate} className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-lift space-y-4">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="mt-3 text-xl font-bold">Restricted</h1>
            <p className="text-xs text-muted-foreground">Enter admin password to continue.</p>
          </div>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Password"
            autoFocus
            className="h-12"
          />
          <Button type="submit" className="w-full h-12 bg-gradient-primary font-bold">Unlock</Button>
        </form>
      </div>
    );
  }

  if (state === "checking" || state === "idle") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (state === "deny") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-2xl font-bold">Admin account required</h1>
        <p className="text-muted-foreground max-w-sm">
          The password is correct, but you also need to be signed in with the admin account.
        </p>
        <Button onClick={() => nav({ to: "/auth" })}>Sign in</Button>
        <button
          onClick={() => { sessionStorage.removeItem(GATE_KEY); setGateOk(false); }}
          className="text-xs text-muted-foreground hover:underline mt-2"
        >
          Lock again
        </button>
      </div>
    );
  }
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
