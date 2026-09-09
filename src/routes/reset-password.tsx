import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Reset password — Guru-G" }] }),
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase auto-exchanges the recovery token from the URL and fires PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Fallback: if user already has a session (after the redirect), allow the form too.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated! Please sign in.");
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-1">Set a new password</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {ready ? "Choose a strong password you'll remember." : "Validating reset link…"}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>New password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={!ready} />
          </div>
          <div>
            <Label>Confirm password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} disabled={!ready} />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !ready}>
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
