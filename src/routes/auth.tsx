import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Cash Winning League" }] }),
});

type Step = "warning" | "form";
type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("warning");
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const isGmail = (v: string) => /^[^\s@]+@gmail\.com$/i.test(v.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isGmail(email)) return toast.error("Please enter a valid @gmail.com address");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");

    setLoading(true);
    if (mode === "signup") {
      if (password !== confirm) { setLoading(false); return toast.error("Passwords don't match"); }
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName },
        },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Account created! You're signed in.");
      navigate({ to: "/" });
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success("Signed in!");
      navigate({ to: "/" });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-md p-8">
        {step === "warning" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
              <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-center text-2xl font-bold mb-2">Important Notice</h1>
            <div className="space-y-3 text-sm text-muted-foreground mb-6">
              <p>• Sign up uses your <strong>@gmail.com</strong> address and a password <strong>you choose</strong>.</p>
              <p>• Each user must create their <strong>own unique password</strong>. <strong>Save it safely — we cannot recover it.</strong></p>
              <p>• Social logins (Google) and phone-number login are <strong>disabled</strong>.</p>
              <p>• Quizzes are protected by an <strong>anti-cheat system</strong>: tab-switching, copy/paste and dev-tools are blocked.</p>
              <p>• You must be 18+ and play responsibly.</p>
            </div>
            <Button className="w-full h-11" onClick={() => setStep("form")}>
              I understand — Continue
            </Button>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <Link to="/" className="hover:underline">← Back</Link>
              <div className="flex gap-3">
                <Link to="/terms" className="hover:underline">Terms</Link>
                <Link to="/support" className="hover:underline">Support</Link>
              </div>
            </div>
          </>
        )}

        {step === "form" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-center text-2xl font-bold mb-1">
              {mode === "signup" ? "Create your account" : "Sign in"}
            </h1>
            <p className="text-center text-sm text-muted-foreground mb-6">
              Gmail address + your own password.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-6 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={`h-9 rounded-md text-sm font-medium ${mode === "signin" ? "bg-background shadow" : "text-muted-foreground"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`h-9 rounded-md text-sm font-medium ${mode === "signup" ? "bg-background shadow" : "text-muted-foreground"}`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <Label>Full name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required />
                </div>
              )}
              <div>
                <Label>Gmail address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  required
                  autoComplete="email"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Only @gmail.com addresses are accepted.</p>
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                {mode === "signup" && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    ⚠️ Save this password — we can't recover it for you.
                  </p>
                )}
              </div>
              {mode === "signup" && (
                <div>
                  <Label>Confirm password</Label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              )}
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => setStep("warning")}
              className="mt-4 text-xs text-muted-foreground hover:underline w-full text-center"
            >
              ← Back to notice
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
