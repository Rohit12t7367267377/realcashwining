import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Crown, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { purchaseMembership } from "@/lib/social.functions";

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
      { title: "Premium Subscription — Cash Winning League" },
      { name: "description", content: "Subscribe to premium: ad-free play, premium-only contests, bonus XP and priority support." },
      { property: "og:title", content: "Premium Subscription — Cash Winning League" },
      { property: "og:description", content: "Unlock premium contests, ad-free play and bonus rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const nav = useNavigate();
  const [cfg, setCfg] = useState<SubscribeConfig>(SUBSCRIBE_DEFAULTS);
  const [plans, setPlans] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", SUBSCRIBE_SETTING_KEY).maybeSingle(),
        supabase.from("memberships").select("*").eq("active", true).order("sort_order"),
      ]);
      if (s?.value) setCfg({ ...SUBSCRIBE_DEFAULTS, ...(s.value as Partial<SubscribeConfig>) });
      setPlans(p ?? []);
      localStorage.setItem(SUBSCRIBE_SEEN_KEY, "1");
    })();
  }, []);

  async function buy(id: string) {
    setBusy(id);
    try {
      const r = await purchaseMembership({ data: { membership_id: id } });
      toast.success(`Active until ${new Date(r.ends_at).toLocaleDateString()}`);
      nav({ to: "/" });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not subscribe");
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
        {plans.map((p) => (
          <div key={p.id} className="rounded-3xl bg-card p-4 shadow-soft">
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
            {Array.isArray(p.perks) && p.perks.length > 0 && (
              <div className="mt-2 text-[11px] text-muted-foreground">{p.perks.join(" · ")}</div>
            )}
            <Button className="press mt-3 w-full bg-gradient-primary font-bold" disabled={busy === p.id} onClick={() => buy(p.id)}>
              {busy === p.id ? "Processing…" : cfg.ctaLabel}
            </Button>
          </div>
        ))}
        {plans.length === 0 && (
          <p className="rounded-3xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
            No subscription plans are available right now.
          </p>
        )}
      </div>

      <Link to="/" className="mt-4 block text-center text-xs font-bold text-muted-foreground hover:underline">
        Maybe later — continue to app
      </Link>
    </AppShell>
  );
}
