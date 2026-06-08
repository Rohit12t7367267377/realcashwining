import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Cash Winning League" }] }),
});

type Step = "warning" | "email" | "otp";

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("warning");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const isGmail = (v: string) => /^[^\s@]+@gmail\.com$/i.test(v.trim());

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!isGmail(email)) return toast.error("Please enter a valid @gmail.com address");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("OTP sent to your Gmail");
    setStep("otp");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) return toast.error("Enter the 6-digit code");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in!");
    navigate({ to: "/" });
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
              <p>• Sign in is allowed <strong>only with a valid @gmail.com address</strong>.</p>
              <p>• We will send a <strong>one-time password (OTP)</strong> to your Gmail. No passwords are saved.</p>
              <p>• Social logins (Google button) and phone-number login are <strong>disabled</strong>.</p>
              <p>• Quizzes are protected by an <strong>anti-cheat system</strong>: tab-switching, copy/paste and dev-tools are blocked.</p>
              <p>• You must be 18+ and play responsibly.</p>
            </div>
            <Button className="w-full h-11" onClick={() => setStep("email")}>
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

        {step === "email" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-center text-2xl font-bold mb-1">Sign in with Gmail</h1>
            <p className="text-center text-sm text-muted-foreground mb-6">We'll email you a 6-digit code.</p>
            <form onSubmit={sendOtp} className="space-y-4">
              <div>
                <Label>Full name <span className="text-xs text-muted-foreground">(new users)</span></Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
              </div>
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
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Sending…" : "Send OTP"}
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

        {step === "otp" && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-center text-2xl font-bold mb-1">Enter OTP</h1>
            <p className="text-center text-sm text-muted-foreground mb-6">
              Code sent to <strong>{email}</strong>
            </p>
            <form onSubmit={verifyOtp} className="space-y-4">
              <div>
                <Label>6-digit code</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="text-center text-2xl tracking-[0.5em] font-bold"
                  required
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? "Verifying…" : "Verify & Continue"}
              </Button>
            </form>
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); }}
              className="mt-4 text-xs text-muted-foreground hover:underline w-full text-center"
            >
              Use a different email
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
