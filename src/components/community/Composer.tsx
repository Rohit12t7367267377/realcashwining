import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { createPost } from "@/lib/community.functions";
import { CATEGORIES, checkUpload, type CategoryId, type MediaKind } from "@/lib/community-policy";

const HINT: Record<CategoryId, string> = {
  post: "Explain a concept clearly. Share what you understood and how.", video: "Share a short lesson or a worked solution (MP4/WebM, up to 100 MB).",
  quiz: "Describe your quiz, or attach a free contest from Guru-G.", notes: "Share revision notes, diagrams or a PDF (up to 20 MB).",
  exam_tip: "A tip that helps with an exam: strategy, timing, common mistakes.", news: "Education or science news. A source link is required; posts stay 'unverified' until a moderator checks them.",
  discussion: "Ask a question or start a topic discussion.",
};

function videoDuration(file: File): Promise<number | undefined> {
  return new Promise((res) => {
    const v = document.createElement("video"); v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); res(Number.isFinite(v.duration) ? Math.round(v.duration) : undefined); };
    v.onerror = () => res(undefined); v.src = URL.createObjectURL(file);
  });
}

export function Composer({ open, onClose, userId, onPosted }: { open: boolean; onClose: () => void; userId: string; onPosted: () => void }) {
  const [category, setCategory] = useState<CategoryId>("post");
  const [f, setF] = useState({ title: "", body: "", subject: "", examTag: "", educationLevel: "", sourceUrl: "", sourcePublishedOn: "", quizContestId: "" });
  const [file, setFile] = useState<File | null>(null), [kind, setKind] = useState<MediaKind | null>(null), [busy, setBusy] = useState(false);
  const [quizzes, setQuizzes] = useState<{ id: string; title: string }[]>([]);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open || category !== "quiz" || quizzes.length) return;
    void supabase.from("contests").select("id,title").eq("active", true).eq("entry_fee", 0).order("created_at", { ascending: false }).limit(30).then(({ data }) => setQuizzes((data ?? []) as { id: string; title: string }[]));
  }, [open, category, quizzes.length]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const reset = () => { setF({ title: "", body: "", subject: "", examTag: "", educationLevel: "", sourceUrl: "", sourcePublishedOn: "", quizContestId: "" }); setFile(null); setKind(null); setCategory("post"); if (ref.current) ref.current.value = ""; };

  function pick(fl: File | null) {
    if (!fl) return;
    const c = checkUpload(fl);
    if (!c.ok) { toast.error(c.error); if (ref.current) ref.current.value = ""; return; }
    setFile(fl); setKind(c.kind);
  }
  async function submit() {
    setBusy(true);
    try {
      let media: { path: string; kind: MediaKind; durationSeconds?: number } | undefined;
      if (file && kind) {
        const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("community").upload(path, file, { contentType: file.type });
        if (error) throw new Error(error.message);
        media = { path, kind, durationSeconds: kind === "video" ? await videoDuration(file) : undefined };
      }
      const r = await createPost({ data: {
        category, body: f.body, title: f.title || undefined, subject: f.subject || undefined, examTag: f.examTag || undefined, educationLevel: f.educationLevel || undefined,
        sourceUrl: f.sourceUrl || undefined, sourcePublishedOn: f.sourcePublishedOn || undefined, quizContestId: f.quizContestId || undefined, media,
      } });
      toast.success(r.pendingApproval ? "Submitted. It will appear after a moderator approves it." : "Posted!");
      reset(); onClose(); onPosted();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not post"); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Create a post</DialogTitle><DialogDescription>Community is for learning. Posts are checked against our education-only policy.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div role="radiogroup" aria-label="Post type" className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => <button key={c.id} type="button" role="radio" aria-checked={category === c.id} onClick={() => setCategory(c.id)} className={`rounded-full px-3 py-1 text-xs font-bold ${category === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{c.label}</button>)}
          </div>
          <p className="text-xs text-muted-foreground">{HINT[category]}</p>
          <Input aria-label="Title (optional)" placeholder="Title (optional)" maxLength={140} value={f.title} onChange={set("title")} />
          <Textarea aria-label="Post text" placeholder="Write your post…" rows={6} maxLength={5000} value={f.body} onChange={set("body")} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div><Label className="text-xs">Subject</Label><Input placeholder="e.g. Physics" maxLength={60} value={f.subject} onChange={set("subject")} /></div>
            <div><Label className="text-xs">Exam</Label><Input placeholder="e.g. JEE Main" maxLength={60} value={f.examTag} onChange={set("examTag")} /></div>
            <div><Label className="text-xs">Class / level</Label><Input placeholder="e.g. Class 11" maxLength={60} value={f.educationLevel} onChange={set("educationLevel")} /></div>
          </div>
          {category === "news" && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div><Label className="text-xs">Source link (required)</Label><Input type="url" placeholder="https://…" maxLength={500} value={f.sourceUrl} onChange={set("sourceUrl")} /></div>
              <div><Label className="text-xs">Published on</Label><Input type="date" value={f.sourcePublishedOn} onChange={set("sourcePublishedOn")} /></div>
            </div>
          )}
          {category === "quiz" && (
            <div><Label className="text-xs">Attach a free Guru-G quiz (optional)</Label>
              <Select value={f.quizContestId || "none"} onValueChange={(v) => setF((p) => ({ ...p, quizContestId: v === "none" ? "" : v }))}>
                <SelectTrigger aria-label="Quiz"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">No attached quiz</SelectItem>{quizzes.map((q) => <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>)}</SelectContent>
              </Select></div>
          )}
          <div>
            <input ref={ref} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            {file ? <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm"><span className="truncate">{file.name} · {(file.size / 1048576).toFixed(1)} MB</span><Button size="icon" variant="ghost" aria-label="Remove file" onClick={() => { setFile(null); setKind(null); if (ref.current) ref.current.value = ""; }}><X className="h-4 w-4" /></Button></div>
              : <Button type="button" variant="outline" onClick={() => ref.current?.click()}><ImagePlus className="mr-2 h-4 w-4" />Add image, video or PDF</Button>}
          </div>
          <Button className="w-full bg-gradient-primary font-bold" onClick={() => void submit()} disabled={busy || (!f.body.trim() && !file && !f.quizContestId)}>{busy && <Loader2 className="animate-spin" />} Post</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
