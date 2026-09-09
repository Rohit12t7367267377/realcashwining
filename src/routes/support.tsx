import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, MessageCircleQuestion } from "lucide-react";

const SUPPORT_EMAIL = "my5270970@gmail.com";

export const Route = createFileRoute("/support")({
  component: SupportPage,
  head: () => ({
    meta: [
      { title: "Help & Support — Guru-G" },
      { name: "description", content: "Need help? Contact our support team or browse common questions." },
    ],
  }),
});

const FAQS = [
  {
    q: "How do I add money to my wallet?",
    a: "Open the Wallet tab, tap Add Money, pay via UPI to the displayed UPI ID, and submit the UTR. Admin will verify and credit within a few hours.",
  },
  {
    q: "When will my withdrawal be processed?",
    a: "Withdrawals are reviewed manually and paid out to your UPI ID within 24–72 hours.",
  },
  {
    q: "How are contest winners decided?",
    a: "By highest score. Ties are broken by who submitted first.",
  },
  {
    q: "I joined a contest but it didn't start. What do I do?",
    a: "Email us with your contest ID and a screenshot. We'll investigate and refund the entry fee if needed.",
  },
  {
    q: "How do I download a study PDF?",
    a: "Go to the Books page, find the PDF you want, and tap Download. It's free for all signed-in users.",
  },
];

function SupportPage() {
  const subject = encodeURIComponent("Help needed — Guru-G");
  const body = encodeURIComponent("Hi team,\n\nI need help with:\n\n");
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

  return (
    <AppShell>
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-lift">
        <MessageCircleQuestion className="h-8 w-8" />
        <h1 className="mt-3 text-2xl font-black">Help &amp; Support</h1>
        <p className="mt-1 text-sm opacity-90">We usually reply within 24 hours.</p>
        <a href={mailto}>
          <Button className="mt-4 h-11 w-full bg-white text-primary font-bold hover:bg-white/90">
            <Mail className="mr-2 h-4 w-4" /> Email Support
          </Button>
        </a>
        <p className="mt-3 text-center text-xs opacity-80">
          or write to <span className="font-mono">{SUPPORT_EMAIL}</span>
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Frequently asked</h2>
        <div className="mt-3 space-y-3">
          {FAQS.map((f, i) => (
            <details key={i} className="group rounded-2xl bg-card p-4 shadow-soft">
              <summary className="cursor-pointer list-none font-bold text-sm flex items-center justify-between">
                {f.q}
                <span className="text-primary group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Read our <Link to="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>
      </p>
    </AppShell>
  );
}
