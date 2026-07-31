import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/search")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Search — Cash Winning League" },
      { name: "description", content: "Search contests, categories, players, books and help articles across the app." },
      { property: "og:title", content: "Search Cash Winning League" },
      { property: "og:description", content: "Find contests, categories, players and help articles instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
});

type Results = {
  contests: any[];
  categories: any[];
  players: any[];
  books: any[];
  faqs: any[];
};

const EMPTY: Results = { contests: [], categories: [], players: [], books: [], faqs: [] };

function SearchPage() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRes(EMPTY);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const like = `%${term}%`;
      const [contests, categories, players, books, faqs] = await Promise.all([
        supabase.from("contests").select("id,title,entry_fee,prize_pool,active,results_status").ilike("title", like).limit(10),
        supabase.from("categories").select("id,name,description").eq("active", true).ilike("name", like).limit(10),
        supabase.from("profiles").select("id,full_name").ilike("full_name", like).limit(10),
        supabase.from("books").select("id,title,category").ilike("title", like).limit(10),
        supabase.from("faqs").select("id,question,answer").eq("active", true).ilike("question", like).limit(10),
      ]);
      if (cancelled) return;
      setRes({
        contests: contests.data ?? [],
        categories: categories.data ?? [],
        players: players.data ?? [],
        books: books.data ?? [],
        faqs: faqs.data ?? [],
      });
      setLoading(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const total = res.contests.length + res.categories.length + res.players.length + res.books.length + res.faqs.length;

  return (
    <AppShell>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-black">
        <SearchIcon className="h-5 w-5 text-primary" /> Search
      </h1>
      <p className="mb-4 text-xs text-muted-foreground">Contests, categories, players, library and help.</p>

      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search contests, players, categories…"
        className="mb-4"
      />

      {q.trim().length >= 2 && !loading && total === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">No results for “{q.trim()}”.</Card>
      )}

      <div className="space-y-6">
        {res.contests.length > 0 && (
          <Section title="Contests">
            {res.contests.map((c) => (
              <Link key={c.id} to="/contest/$id" params={{ id: c.id }} className="block">
                <Card className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.title}</div>
                    <div className="text-xs text-muted-foreground">
                      Entry ₹{Number(c.entry_fee).toFixed(0)} · Pool ₹{Number(c.prize_pool).toFixed(0)}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">
                    {c.results_status === "declared" ? "Declared" : c.active ? "Live" : "Upcoming"}
                  </span>
                </Card>
              </Link>
            ))}
          </Section>
        )}

        {res.categories.length > 0 && (
          <Section title="Categories">
            {res.categories.map((c) => (
              <Link key={c.id} to="/category/$id" params={{ id: c.id }} className="block">
                <Card className="p-3">
                  <div className="text-sm font-semibold">{c.name}</div>
                  {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
                </Card>
              </Link>
            ))}
          </Section>
        )}

        {res.players.length > 0 && (
          <Section title="Players">
            {res.players.map((p) => (
              <Card key={p.id} className="p-3 text-sm font-semibold">{p.full_name || "Player"}</Card>
            ))}
          </Section>
        )}

        {res.books.length > 0 && (
          <Section title="Library">
            {res.books.map((b) => (
              <Link key={b.id} to="/books" className="block">
                <Card className="p-3">
                  <div className="text-sm font-semibold">{b.title}</div>
                  {b.category && <div className="text-xs text-muted-foreground">{b.category}</div>}
                </Card>
              </Link>
            ))}
          </Section>
        )}

        {res.faqs.length > 0 && (
          <Section title="Help">
            {res.faqs.map((f) => (
              <Card key={f.id} className="p-3">
                <div className="text-sm font-semibold">{f.question}</div>
                <div className="text-xs text-muted-foreground">{f.answer}</div>
              </Card>
            ))}
          </Section>
        )}
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
