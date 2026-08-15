import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-store";
import { getGuruLibrary, getGuruBook } from "@/lib/guru-hub.functions";
import { ArrowLeft, BookOpen, Library as LibraryIcon, Search } from "lucide-react";

export const Route = createFileRoute("/guru/library")({
  head: () => ({
    meta: [
      { title: "Guru.AI Library — Every Book, Chapter & Topic" },
      { name: "description", content: "Open any curriculum book in the Guru.AI Library and jump straight into a chapter topic with your AI teacher." },
      { property: "og:title", content: "Guru.AI Library" },
      { property: "og:description", content: "Board books, chapters and topics, all AI-taught." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuruLibraryPage,
});

function GuruLibraryPage() {
  const { state } = useUser();
  const loadBooks = useServerFn(getGuruLibrary);
  const loadBook = useServerFn(getGuruBook);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [openBook, setOpenBook] = useState<{ id: string; title: string } | null>(null);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["guru-library", query],
    queryFn: () => loadBooks({ data: query ? { search: query } : {} }),
    enabled: state.loggedIn,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["guru-book", openBook?.id],
    queryFn: () => loadBook({ data: { book_id: openBook!.id } }),
    enabled: Boolean(openBook?.id),
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to open the Library</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  if (openBook) {
    return (
      <AppShell>
        <button type="button" onClick={() => setOpenBook(null)} className="press mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All books
        </button>
        <h1 className="text-xl font-black">{openBook.title}</h1>
        <div className="mt-3 grid gap-2">
          {chapters.map((c) => (
            <div key={c.id} className="rounded-2xl bg-card p-3 shadow-soft">
              <div className="text-sm font-bold">{c.title}</div>
              {c.summary && <div className="mt-0.5 text-[11px] text-muted-foreground">{c.summary}</div>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.topics.map((t) => (
                  <Link key={t.id} to="/guru/topic/$id" params={{ id: t.id }} className="press rounded-full bg-secondary px-3 py-1 text-[11px] font-bold">
                    {t.title}
                  </Link>
                ))}
                {c.topics.length === 0 && <span className="text-[11px] text-muted-foreground">Topics coming soon</span>}
              </div>
            </div>
          ))}
          {chapters.length === 0 && <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">No chapters in this book yet.</div>}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <LibraryIcon className="h-3.5 w-3.5" /> Guru.AI Library
        </div>
        <h1 className="mt-1 text-2xl font-black">Every book, one tap away</h1>
        <p className="mt-1 text-sm opacity-90">Pick a book, open a chapter, learn the topic with your AI teacher.</p>
      </section>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}
      >
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search books…" />
        <Button type="submit" className="bg-gradient-primary"><Search className="h-4 w-4" /></Button>
      </form>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {isLoading && <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">Loading library…</div>}
        {books.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setOpenBook({ id: b.id, title: b.title })}
            className="press card-lift rounded-2xl bg-card p-3 text-left shadow-soft"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{b.emoji}</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-black">{b.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {[b.board, b.className, b.subject].filter(Boolean).join(" • ")}
                </div>
              </div>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
              <BookOpen className="h-3.5 w-3.5" /> {b.chapters} chapters
            </div>
          </button>
        ))}
        {!isLoading && books.length === 0 && (
          <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">No books matched your search.</div>
        )}
      </div>
    </AppShell>
  );
}
