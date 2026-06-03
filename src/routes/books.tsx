import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Download, Search } from "lucide-react";
import { toast } from "sonner";

type Book = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  file_path: string;
  file_size: number | null;
  downloads: number;
  created_at: string;
};

export const Route = createFileRoute("/books")({
  component: BooksPage,
  head: () => ({
    meta: [
      { title: "Study Books — Cash Winning League" },
      { name: "description", content: "Free PDF books for SSC, UPSC, Banking, Railway and more exam preparation." },
    ],
  }),
});

function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setBooks((data as Book[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => {
    const s = new Set<string>();
    books.forEach((b) => b.category && s.add(b.category));
    return ["all", ...Array.from(s)];
  }, [books]);

  const filtered = useMemo(() => {
    return books.filter((b) => {
      if (cat !== "all" && b.category !== cat) return false;
      if (query) {
        const q = query.toLowerCase();
        return b.title.toLowerCase().includes(q) || (b.description ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [books, query, cat]);

  async function download(book: Book) {
    const { data, error } = await supabase.storage.from("books").createSignedUrl(book.file_path, 60);
    if (error || !data?.signedUrl) return toast.error("Couldn't get download link");
    await supabase.rpc("increment_book_download", { _book_id: book.id });
    setBooks((bs) => bs.map((x) => (x.id === book.id ? { ...x, downloads: x.downloads + 1 } : x)));
    window.open(data.signedUrl, "_blank");
  }

  return (
    <AppShell>
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift">
        <BookOpen className="h-7 w-7" />
        <h1 className="mt-2 text-2xl font-black">Study Books</h1>
        <p className="text-sm opacity-90">Free PDFs curated for exam preparation.</p>
      </section>

      <div className="mt-5 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by title or description…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
              cat === c ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {loading && <p className="text-sm text-muted-foreground text-center py-10">Loading books…</p>}
        {!loading && filtered.length === 0 && (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground shadow-soft">
            No books found{query && ` for "${query}"`}.
          </p>
        )}
        {filtered.map((b) => (
          <div key={b.id} className="rounded-2xl bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-sm font-bold">{b.title}</div>
                {b.category && (
                  <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                    {b.category}
                  </span>
                )}
                {b.description && <p className="mt-2 text-xs text-muted-foreground">{b.description}</p>}
                <div className="mt-2 text-[10px] text-muted-foreground">
                  {b.downloads} downloads
                  {b.file_size ? ` · ${(b.file_size / 1024 / 1024).toFixed(1)} MB` : ""}
                </div>
              </div>
              <Button onClick={() => download(b)} size="sm" className="bg-gradient-primary">
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
