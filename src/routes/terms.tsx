import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Guru-G" },
      { name: "description", content: "Terms of use for participating in Guru-G quiz contests." },
    ],
  }),
});

function TermsPage() {
  return (
    <AppShell>
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-3xl font-black">Terms &amp; Conditions</h1>
      <p className="mt-1 text-xs text-muted-foreground">Last updated: 3 June 2026</p>

      <article className="prose prose-sm dark:prose-invert mt-6 max-w-none space-y-5 text-sm leading-relaxed">
        <Section title="1. Acceptance of Terms">
          By creating an account or participating in any contest on Guru-G ("Guru-G", "we", "us"),
          you agree to be bound by these Terms &amp; Conditions. If you do not agree, do not use the platform.
        </Section>
        <Section title="2. Eligibility">
          You must be 18 years or older and a resident of a jurisdiction where skill-based online gaming is legal.
          The platform is not available to residents of states where it is restricted by law (e.g. Assam, Odisha,
          Telangana, Andhra Pradesh, Nagaland, Sikkim).
        </Section>
        <Section title="3. Game of Skill">
          All contests on Guru-G are games of skill. Outcomes depend on a player's knowledge, attention, and accuracy.
          No element of chance determines winners.
        </Section>
        <Section title="4. Wallet, Deposits & Withdrawals">
          <ul className="list-disc pl-5 space-y-1">
            <li>Deposits are reviewed manually by admin and credited after verification of payment.</li>
            <li>Withdrawals are processed to your registered UPI ID within 24–72 hours of approval.</li>
            <li>Minimum withdrawal: ₹100. Wallet balance is non-transferable.</li>
            <li>Any fraudulent or duplicate deposit will lead to permanent account suspension.</li>
          </ul>
        </Section>
        <Section title="5. Contest Rules">
          <ul className="list-disc pl-5 space-y-1">
            <li>Entry fees are deducted on contest join and are non-refundable once the contest begins.</li>
            <li>The prize pool is fixed and announced upfront.</li>
            <li>Winners are decided by score; ties are broken by submission time.</li>
            <li>Use of bots, scripts, or multiple accounts is strictly prohibited.</li>
          </ul>
        </Section>
        <Section title="6. Live Sports Quizzes">
          For cricket and football live-match contests, questions reflect real-time match events.
          Decisions made by Guru-G admins regarding question validity are final.
        </Section>
        <Section title="7. Books Library">
          PDFs uploaded to the Books section are for study purposes only. Guru-G does not claim ownership
          of uploaded content. Report copyright concerns at <Mail />.
        </Section>
        <Section title="8. Account Suspension">
          We reserve the right to suspend or ban any account that violates these terms, attempts to
          manipulate results, or engages in abusive behaviour.
        </Section>
        <Section title="9. Limitation of Liability">
          Guru-G is not liable for any indirect, incidental, or consequential losses arising from use of the platform.
        </Section>
        <Section title="10. Changes">
          We may update these terms at any time. Continued use of Guru-G after changes constitutes acceptance.
        </Section>
        <Section title="11. Contact">
          For any concerns, write to us at <Mail />.
        </Section>
      </article>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold">{title}</h2>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </section>
  );
}

function Mail() {
  return <a href="mailto:my5270970@gmail.com" className="text-primary hover:underline">my5270970@gmail.com</a>;
}
