import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BookOpen, Download } from "lucide-react";
import { toast } from "sonner";

type Book = { id: string; title: string; category: string | null; file_path: string; downloads: number };

/** Library preview inside Guru.AI — latest study PDFs uploaded by admin. */
export function LibrarySection() {
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("books")
        .select("id, title, category, file_path, downloads")
        .order("created_at", { ascending: false })
        .limit(6);
      setBooks((data as Book[]) ?? []);
    })();
  }, []);

  async function download(book: Book) {
    const { data, error } = await supabase.storage.from("books").createSignedUrl(book.file_path, 60);
    if (error || !data?.signedUrl) return toast.error("Couldn't get download link");
    await supabase.rpc("increment_book_download", { _book_id: book.id });
    window.open(data.signedUrl, "_blank");
  }

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <BookOpen className="h-4 w-4" /> Library
        </h2>
        <Link to="/books" className="text-xs font-bold text-primary hover:underline">
          All books →
        </Link>
      </div>
      {books.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">
          No study PDFs yet — the library fills up as admin uploads books.
        </p>
      ) : (
        <div className="space-y-2">
          {books.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 shadow-soft">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{b.title}</div>
                <div className="text-[10px] text-muted-foreground">
                  {b.category ? `${b.category} · ` : ""}
                  {b.downloads} downloads
                </div>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => download(b)}>
                <Download className="mr-1 h-4 w-4" /> PDF
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
