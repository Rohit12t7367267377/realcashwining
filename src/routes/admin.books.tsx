import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BookOpen, Trash2, Download } from "lucide-react";

export const Route = createFileRoute("/admin/books")({ component: AdminBooksPage });

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

function AdminBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setBooks((data as Book[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Pick a PDF file");
    if (!title.trim()) return toast.error("Title required");
    if (file.size > 50 * 1024 * 1024) return toast.error("File must be under 50MB");

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("books").upload(path, file, {
        contentType: file.type || "application/pdf",
      });
      if (upErr) throw upErr;

      const { data: { user } } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("books").insert({
        title: title.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
        file_path: path,
        file_size: file.size,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) throw insErr;

      toast.success("Book uploaded");
      setTitle(""); setDescription(""); setCategory(""); setFile(null);
      const input = document.getElementById("book-file") as HTMLInputElement | null;
      if (input) input.value = "";
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function remove(b: Book) {
    if (!confirm(`Delete "${b.title}"?`)) return;
    const { error: sErr } = await supabase.storage.from("books").remove([b.file_path]);
    if (sErr) toast.error(sErr.message);
    const { error } = await supabase.from("books").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setBooks((bs) => bs.filter((x) => x.id !== b.id));
  }

  async function downloadOne(b: Book) {
    const { data, error } = await supabase.storage.from("books").createSignedUrl(b.file_path, 60);
    if (error || !data?.signedUrl) return toast.error("Couldn't open file");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
        <BookOpen className="h-7 w-7" /> Books Library
      </h1>
      <p className="text-muted-foreground mb-6">Upload PDFs for students. They appear instantly on the public /books page.</p>

      <Card className="p-5 mb-8">
        <h2 className="font-bold mb-4">Upload new PDF</h2>
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>
          <div>
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="SSC, UPSC, Banking…" maxLength={50} />
          </div>
          <div className="md:col-span-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
          </div>
          <div className="md:col-span-2">
            <Label>PDF file (max 50MB)</Label>
            <Input
              id="book-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={uploading} className="bg-gradient-primary">
              {uploading ? "Uploading…" : "Upload PDF"}
            </Button>
          </div>
        </form>
      </Card>

      <h2 className="font-bold mb-3">All books ({books.length})</h2>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="space-y-2">
        {books.map((b) => (
          <Card key={b.id} className="p-4 flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="font-bold text-sm">{b.title}</div>
              <div className="text-xs text-muted-foreground">
                {b.category ?? "Uncategorised"} · {b.downloads} downloads
                {b.file_size ? ` · ${(b.file_size / 1024 / 1024).toFixed(1)} MB` : ""}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => downloadOne(b)}>
              <Download className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => remove(b)} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
        {!loading && books.length === 0 && (
          <p className="text-sm text-muted-foreground">No books yet. Upload your first PDF above.</p>
        )}
      </div>
    </div>
  );
}
