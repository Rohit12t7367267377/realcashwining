import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { submitFeedback } from "@/lib/social.functions";

export const Route = createFileRoute("/feedback")({
  head: () => ({ meta: [
    { title: "Send Feedback — Guru-G" },
    { name: "description", content: "Rate the app and share suggestions with our team." },
    { property: "og:title", content: "Send Feedback" },
    { property: "og:description", content: "Help us improve the app." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: Page,
});

function Page() {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [cat, setCat] = useState("general");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    try { await submitFeedback({ data: { rating, category: cat, body: body.trim() } }); toast.success("Thanks for your feedback!"); setBody(""); setRating(5); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <AppShell>
      <div className="max-w-lg mx-auto p-4">
        <h1 className="text-3xl font-bold mb-1">Rate & Feedback</h1>
        <p className="text-muted-foreground mb-6">How are we doing?</p>
        <Card className="p-5 space-y-4">
          <div>
            <div className="text-sm mb-2">Your rating</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)}>
                  <Star className={`w-8 h-8 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm mb-1">Category</div>
            <select className="w-full border rounded p-2 bg-background" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="general">General</option><option value="bug">Bug report</option><option value="feature">Feature request</option><option value="payment">Payment issue</option><option value="other">Other</option>
            </select>
          </div>
          <Textarea placeholder="Tell us more..." value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
          <Button className="w-full" onClick={submit} disabled={busy || !body.trim()}>{busy ? "Sending…" : "Send feedback"}</Button>
        </Card>
      </div>
    </AppShell>
  );
}
