import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useUser } from "@/lib/user-store";
import { toast } from "sonner";
import { Phone, Shield } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — Cash Winning League" }] }),
  component: Login,
});

function Login() {
  const { login, state } = useUser();
  const nav = useNavigate();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));

  if (state.loggedIn) {
    nav({ to: "/" });
    return null;
  }

  const sendOtp = () => {
    if (!/^\d{10}$/.test(phone)) return toast.error("Enter a valid 10-digit phone");
    if (name.trim().length < 2) return toast.error("Enter your name");
    setStep("otp");
    toast.success(`OTP sent! (demo: ${generatedOtp})`, { duration: 6000 });
  };

  const verify = () => {
    if (otp !== generatedOtp) return toast.error("Incorrect OTP");
    login(name.trim(), phone);
    toast.success("Welcome! ₹50 welcome bonus added 🎉");
    nav({ to: "/" });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-20 -left-20 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-secondary/30 blur-3xl" />
      </div>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <Link to="/" className="mb-8 flex items-center gap-2 self-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-2xl font-black text-primary-foreground shadow-glow">₹</span>
          <div>
            <div className="text-lg font-black">Cash Winning</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">League</div>
          </div>
        </Link>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-lift">
          {step === "phone" ? (
            <>
              <div className="mb-5">
                <h1 className="text-2xl font-bold">Welcome 👋</h1>
                <p className="text-sm text-muted-foreground">Sign in or sign up — we'll send a quick OTP.</p>
              </div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" className="h-12" />
              <label className="mb-1.5 mt-4 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="9876543210"
                  inputMode="numeric"
                  className="h-12 pl-9"
                />
              </div>
              <Button onClick={sendOtp} size="lg" className="mt-6 h-12 w-full bg-gradient-primary text-base font-bold shadow-glow">
                Send OTP
              </Button>
            </>
          ) : (
            <>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Verify OTP</h1>
                  <p className="text-xs text-muted-foreground">Sent to +91 {phone}</p>
                </div>
              </div>
              <div className="flex justify-center py-2">
                <InputOTP maxLength={4} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="h-14 w-14 text-xl" />
                    <InputOTPSlot index={1} className="h-14 w-14 text-xl" />
                    <InputOTPSlot index={2} className="h-14 w-14 text-xl" />
                    <InputOTPSlot index={3} className="h-14 w-14 text-xl" />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">Demo OTP: <span className="font-mono font-bold text-primary">{generatedOtp}</span></p>
              <Button onClick={verify} size="lg" className="mt-5 h-12 w-full bg-gradient-primary text-base font-bold shadow-glow">
                Verify & Continue
              </Button>
              <button onClick={() => setStep("phone")} className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground">
                Change phone number
              </button>
            </>
          )}
        </div>
        <p className="mt-6 text-center text-[10px] text-muted-foreground">
          By continuing you agree to our Terms & Privacy. Demo app — no real transactions.
        </p>
      </div>
    </div>
  );
}
