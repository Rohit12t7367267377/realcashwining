import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Cash Winning League" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Reset link sent. Check your email.");
    setForgotOpen(false);
    setForgotEmail("");
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      toast.success("Signed in with Google");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message ?? "Google sign-in failed");
      setGoogleLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-1">{mode === "login" ? "Welcome back" : "Create account"}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "login" ? "Sign in to play & manage your wallet." : "First account becomes admin automatically."}
        </p>

        <Button
          type="button"
          variant="outline"
          className="w-full h-11 mb-4"
          disabled={googleLoading}
          onClick={signInWithGoogle}
        >
          <GoogleIcon /> {googleLoading ? "Redirecting…" : `Continue with Google`}
        </Button>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
          <span className="relative bg-card px-3 text-xs uppercase tracking-wider text-muted-foreground">or with email</span>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : mode === "login" ? "Sign in" : "Sign up"}
          </Button>
        </form>
        {mode === "login" && (
          <button
            type="button"
            onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
            className="mt-3 text-xs text-muted-foreground hover:text-primary hover:underline w-full text-center"
          >
            Forgot password?
          </button>
        )}
        <button
          type="button"
          className="mt-4 text-sm text-primary hover:underline w-full text-center"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Back</Link>
          <div className="flex gap-3">
            <Link to="/terms" className="hover:underline">Terms</Link>
            <Link to="/support" className="hover:underline">Support</Link>
          </div>
        </div>
      </Card>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>Enter your email and we'll send you a reset link.</DialogDescription>
          </DialogHeader>
          <form onSubmit={sendReset} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={forgotLoading} className="w-full">
                {forgotLoading ? "Sending…" : "Send reset link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.12A6.61 6.61 0 0 1 5.49 12c0-.74.13-1.45.35-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.96l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
