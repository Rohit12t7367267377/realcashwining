import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Guru-G" }] }),
});

type Mode = "signin" | "signup";
type Method = "email" | "phone";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [method, setMethod] = useState<Method>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  function normalizedPhone() {
    const digits = phone.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return digits.length === 10 ? `+91${digits}` : `+${digits.replace(/^\+/, "")}`;
  }

  async function sendOtp() {
    const to = normalizedPhone();
    if (to.replace(/[^0-9]/g, "").length < 10) return toast.error("Enter a valid mobile number");
    setOtpLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: to,
      options: { data: { full_name: fullName, phone: to } },
    });
    setOtpLoading(false);
    if (error) return toast.error(error.message);
    setOtpSent(true);
    setResendIn(30);
    toast.success("OTP sent to " + to);
  }

  async function verifyOtp() {
    if (otp.trim().length < 4) return toast.error("Enter the OTP");
    setOtpLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone(),
      token: otp.trim(),
      type: "sms",
    });
    setOtpLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Mobile verified!");
    navigate({ to: "/" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return toast.error("Enter your email");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");

    setLoading(true);
    if (mode === "signup") {
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
      toast.success("Account created!");
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

  async function signInWithGoogle() {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      return toast.error(result.error.message || "Google sign-in failed");
    }
    if (result.redirected) return;
    toast.success("Signed in!");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <Card className="w-full max-w-md p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-center text-2xl font-bold mb-1">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6">
          Fast and simple — sign in with Google or email.
        </p>

        <Button
          type="button"
          variant="outline"
          className="w-full h-11 mb-4"
          onClick={signInWithGoogle}
          disabled={googleLoading}
        >
          <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {googleLoading ? "Opening Google…" : "Continue with Google"}
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 rounded-lg bg-muted p-1">
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

        <div className="grid grid-cols-2 gap-2 mb-4 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => setMethod("phone")}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium ${method === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <Phone className="h-4 w-4" /> Mobile OTP
          </button>
          <button
            type="button"
            onClick={() => setMethod("email")}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium ${method === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <Mail className="h-4 w-4" /> Email
          </button>
        </div>

        {method === "phone" ? (
          <div className="space-y-3">
            {mode === "signup" && (
              <div>
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
              </div>
            )}
            <div>
              <Label>Mobile number</Label>
              <Input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                autoComplete="tel"
                disabled={otpSent}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Indian numbers get +91 automatically.</p>
            </div>
            {otpSent && (
              <div>
                <Label>Enter OTP</Label>
                <Input
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="6-digit code"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>
            )}
            {!otpSent ? (
              <Button type="button" className="w-full h-11" onClick={sendOtp} disabled={otpLoading}>
                {otpLoading ? "Sending OTP…" : "Send OTP"}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button type="button" className="w-full h-11" onClick={verifyOtp} disabled={otpLoading}>
                  {otpLoading ? "Verifying…" : "Verify & continue"}
                </Button>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button type="button" className="hover:underline" onClick={() => { setOtpSent(false); setOtp(""); }}>
                    Change number
                  </button>
                  <button
                    type="button"
                    className="hover:underline disabled:opacity-50"
                    disabled={resendIn > 0 || otpLoading}
                    onClick={sendOtp}
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <div>
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            </div>
          )}
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Home</Link>
          <div className="flex gap-3">
            <Link to="/terms" className="hover:underline">Terms</Link>
            <Link to="/support" className="hover:underline">Support</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
