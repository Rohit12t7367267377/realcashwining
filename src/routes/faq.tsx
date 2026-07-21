import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [
    { title: "FAQ & Help Center — Cash Winning League" },
    { name: "description", content: "Answers to common questions about deposits, contests, prizes and withdrawals." },
    { property: "og:title", content: "FAQ & Help Center" },
    { property: "og:description", content: "Get answers to common questions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Page,
});

function Page() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("faqs").select("*").eq("active", true).order("sort_order").then(({ data }) => setRows(data ?? []));
  }, []);
  const grouped = rows.reduce((acc: Record<string, any[]>, r) => { (acc[r.category ?? "General"] ||= []).push(r); return acc; }, {});
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-3xl font-bold mb-1 flex items-center gap-2"><HelpCircle className="w-7 h-7" /> Help Center</h1>
        <p className="text-muted-foreground mb-6">Frequently asked questions.</p>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="mb-6">
            <h2 className="font-semibold text-lg mb-2">{cat}</h2>
            <div className="space-y-2">
              {items.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="font-medium">{r.question}</div>
                  <div className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{r.answer}</div>
                </Card>
              ))}
            </div>
          </div>
        ))}
        {!rows.length && <Card className="p-8 text-center text-muted-foreground">No FAQs yet. Contact support at my5270970@gmail.com.</Card>}
      </div>
    </AppShell>
  );
}
