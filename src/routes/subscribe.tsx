import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Crown, Check, Sparkles, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  createSubscriptionOrder,
  verifySubscriptionPayment,
  subscribeWithWallet,
  getPaymentConfig,
  getMyMembership,
} from "@/lib/membership.functions";

export const SUBSCRIBE_SETTING_KEY = "subscribe_page";
export const SUBSCRIBE_SEEN_KEY = "cwl_subscribe_seen_v1";

export type SubscribeConfig = {
  enabled: boolean;
  audience: "all" | "new";
  title: string;
  subtitle: string;
  highlights: string[];
  ctaLabel: string;
};

export const SUBSCRIBE_DEFAULTS: SubscribeConfig = {
  enabled: false,
  audience: "new",
  title: "Go Premium",
  subtitle: "Unlock premium contests, ad-free play and bonus rewards.",
  highlights: ["Ad-free experience", "Premium-only contests", "Bonus XP on every quiz", "Priority support"],
  ctaLabel: "Subscribe now",
};

export const Route = createFileRoute("/subscribe")({
  head: () => ({
    meta: [
      { title: "Premium Membership — Guru-G" },
      { name: "description", content: "Unlock unlimited Guru.AI, premium contests, creator mode, ad-free play and bonus rewards." },
      { property: "og:title", content: "Premium Membership — Guru-G" },
      { property: "og:description", content: "Unlock unlimited Guru.AI, premium contests, creator mode and ad-free play." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  perks: unknown;
  recommended: boolean | null;
  highlight: string | null;
  sort_order: number | null;
};
type Feature = { id: string; code: string; name: string; description: string | null };

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

function Page() {
  const nav = useNavigate();
  const [cfg, setCfg] = useState<SubscribeConfig>(SUBSCRIBE_DEFAULTS);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [planFeatures, setPlanFeatures] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [mine, setMine] = useState<{ active: boolean; endsAt: string | null; planName: string | null }>({ active: false, endsAt: null, planName: null });

  const createOrder = useServerFn(createSubscriptionOrder);
  const verifyPayment = useServerFn(verifySubscriptionPayment);
  const payWithWallet = useServerFn(subscribeWithWallet);
  const payConfig = useServerFn(getPaymentConfig);
  const myMembership = useServerFn(getMyMembership);
  const [keyId, setKeyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: p }, { data: f }, { data: links }] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", SUBSCRIBE_SETTING_KEY).maybeSingle(),
        supabase.from("memberships").select("*").eq("active", true).order("sort_order"),
        supabase.from("premium_features").select("id, code, name, description").eq("active", true).order("sort_order"),
        supabase.from("membership_features").select("membership_id, feature_id"),
      ]);
      if (s?.value) setCfg({ ...SUBSCRIBE_DEFAULTS, ...(s.value as Partial<SubscribeConfig>) });
      setPlans((p ?? []) as Plan[]);
      setFeatures((f ?? []) as Feature[]);
      const map: Record<string, string[]> = {};
      for (const l of links ?? []) (map[l.membership_id] ??= []).push(l.feature_id);
      setPlanFeatures(map);
      localStorage.setItem(SUBSCRIBE_SEEN_KEY, "1");

      payConfig().then((c) => setKeyId(c.keyId)).catch(() => setKeyId(null));
      myMembership()
        .then((m) => setMine({ active: m.active, endsAt: m.ends_at, planName: m.plan?.name ?? null }))
        .catch(() => undefined);
    })();
  }, []);

  const featureName = (id: string) => features.find((f) => f.id === id);

  async function payOnline(plan: Plan) {
    setBusy(plan.id);
    try {
      if (!keyId) throw new Error("Online payment is not available right now. Try wallet.");
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load the payment window. Check your connection.");
      const order = await createOrder({ data: { membership_id: plan.id } });

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: keyId,
          amount: order.amount_paise,
          currency: order.currency,
          name: "Guru-G",
          description: `${order.plan_name} membership`,
          order_id: order.order_id,
          theme: { color: "#7c3aed" },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
          handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            try {
              const res = await verifyPayment({ data: { payment_row: order.payment_row, ...r } });
              toast.success(res.ends_at ? `Premium active until ${new Date(res.ends_at).toLocaleDateString()}` : "Premium activated");
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error("Verification failed"));
            }
          },
        });
        rzp.open();
      });
      nav({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(null);
    }
  }

  async function payWallet(plan: Plan) {
    setBusy(plan.id);
    try {
      const r = await payWithWallet({ data: { membership_id: plan.id } });
      toast.success(`Premium active until ${new Date(r.ends_at).toLocaleDateString()}`);
      nav({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not subscribe");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <Sparkles className="h-3.5 w-3.5" /> Premium
        </div>
        <h1 className="mt-1 text-2xl font-black">{cfg.title}</h1>
        <p className="mt-1 text-sm opacity-90">{cfg.subtitle}</p>
        {mine.active && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
            <ShieldCheck className="h-3.5 w-3.5" /> {mine.planName ?? "Premium"} active
            {mine.endsAt ? ` · till ${new Date(mine.endsAt).toLocaleDateString()}` : ""}
          </div>
        )}
      </section>

      {cfg.highlights.length > 0 && (
        <ul className="mt-4 space-y-2 rounded-3xl bg-card p-4 shadow-soft">
          {cfg.highlights.map((h) => (
            <li key={h} className="flex items-center gap-2 text-sm font-medium">
              <Check className="h-4 w-4 shrink-0 text-success" /> {h}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-3">
        {plans.map((p) => {
          const ids = planFeatures[p.id] ?? [];
          return (
            <div
              key={p.id}
              className={`relative rounded-3xl bg-card p-4 shadow-soft ${p.recommended ? "ring-2 ring-primary" : ""}`}
            >
              {p.recommended && (
                <span className="absolute -top-2 right-4 rounded-full bg-gradient-primary px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-foreground">
                  {p.highlight || "Best value"}
                </span>
              )}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-base font-black">
                    <Crown className="h-4 w-4 text-amber-500" /> {p.name}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black">₹{p.price}</div>
                  <div className="text-[10px] text-muted-foreground">/{p.duration_days} days</div>
                </div>
              </div>

              {ids.length > 0 && (
                <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                  {ids.map((id) => {
                    const f = featureName(id);
                    if (!f) return null;
                    return (
                      <li key={id} className="flex items-start gap-1.5 text-[12px] font-medium">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                        <span>{f.name}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {Array.isArray(p.perks) && p.perks.length > 0 && (
                <div className="mt-2 text-[11px] text-muted-foreground">{(p.perks as string[]).join(" · ")}</div>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button className="press w-full bg-gradient-primary font-bold" disabled={busy === p.id} onClick={() => payOnline(p)}>
                  {busy === p.id ? "Processing…" : cfg.ctaLabel}
                </Button>
                <Button variant="outline" className="press w-full font-bold" disabled={busy === p.id} onClick={() => payWallet(p)}>
                  <Wallet className="mr-1 h-4 w-4" /> Pay from wallet
                </Button>
              </div>
            </div>
          );
        })}
        {plans.length === 0 && (
          <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
            No subscription plans are available right now.
          </p>
        )}
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Payments are processed securely. Your membership activates instantly after payment.
      </p>

      <Link to="/" className="mt-4 block text-center text-xs font-bold text-muted-foreground hover:underline">
        Maybe later — continue to app
      </Link>
    </AppShell>
  );
}
