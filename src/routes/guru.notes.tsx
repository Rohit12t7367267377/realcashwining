import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/lib/user-store";
import { toast } from "sonner";
import { getClassNotes, listNotesChapters, askNotesDoubt } from "@/lib/guru-notes.functions";
import { NOTES_BOARDS, NOTES_CLASSES, subjectsForClass, gradientFor, type NotesPayload } from "@/lib/guru-notes";
import {
  NotebookPen, ArrowLeft, Sparkles, Lightbulb, Sigma, ListChecks, Target,
  MessageCircleQuestion, Send, Languages, Loader2, BookMarked,
} from "lucide-react";

export const Route = createFileRoute("/guru/notes")({
  head: () => ({
    meta: [
      { title: "Class Notes 1–12 — Every Board, Taught by AI | Guru.AI" },
      { name: "description", content: "Open colourful AI class notes for classes 1 to 12 of any board, read chapter-wise topics and ask any doubt — Guru.AI explains it like your own teacher." },
      { property: "og:title", content: "Guru.AI Class Notes 1–12" },
      { property: "og:description", content: "Board-wise notes for every class and subject, with instant AI doubt solving in English or Hindi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuruNotesPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function GuruNotesPage() {
  const { state } = useUser();
  const loadChapters = useServerFn(listNotesChapters);
  const loadNotes = useServerFn(getClassNotes);
  const ask = useServerFn(askNotesDoubt);

  const [board, setBoard] = useState<string>("");
  const [className, setClassName] = useState<string>("");
  const [subject, setSubject] = useState<string>("");
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [chapters, setChapters] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState<NotesPayload | null>(null);
  const [doubt, setDoubt] = useState("");
  const [chat, setChat] = useState<Msg[]>([]);

  const chapterMut = useMutation({
    mutationFn: (v: { subject: string }) => loadChapters({ data: { board, className, subject: v.subject, language } }),
    onSuccess: (list) => setChapters(list),
    onError: (e: Error) => toast.error(e.message),
  });

  const notesMut = useMutation({
    mutationFn: (t: string) => loadNotes({ data: { board, className, subject, language, topic: t } }),
    onSuccess: (n) => { setNotes(n); setChat([]); },
    onError: (e: Error) => toast.error(e.message),
  });

  const doubtMut = useMutation({
    mutationFn: (q: string) =>
      ask({ data: { board, className, subject, language, topic: notes?.title ?? topic, question: q, history: chat.slice(-8) } }),
    onSuccess: (r) => setChat((c) => [...c, { role: "assistant", content: r.answer }]),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!state.loggedIn) {
    return (
      <AppShell>
        <div className="rounded-3xl bg-card p-6 text-center shadow-soft">
          <h1 className="text-xl font-bold">Sign in to open Class Notes</h1>
          <Link to="/login"><Button className="mt-4 bg-gradient-primary">Sign In</Button></Link>
        </div>
      </AppShell>
    );
  }

  function openTopic(t: string) {
    setTopic(t);
    notesMut.mutate(t);
  }

  function sendDoubt(e: React.FormEvent) {
    e.preventDefault();
    const q = doubt.trim();
    if (!q) return;
    setChat((c) => [...c, { role: "user", content: q }]);
    setDoubt("");
    doubtMut.mutate(q);
  }

  /* ---------------- Notes reader ---------------- */
  if (notes) {
    return (
      <AppShell>
        <button type="button" onClick={() => setNotes(null)} className="press mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to topics
        </button>

        <section className={`overflow-hidden rounded-3xl bg-gradient-to-br ${gradientFor(notes.title)} p-5 text-primary-foreground shadow-lift animate-rise-in`}>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
            <NotebookPen className="h-3.5 w-3.5" /> Class {className} • {subject}
          </div>
          <h1 className="mt-1 text-2xl font-black leading-tight">{notes.title}</h1>
          {notes.intro && <p className="mt-2 text-sm opacity-95">{notes.intro}</p>}
        </section>

        {notes.keyPoints.length > 0 && (
          <Card title="Key points" icon={<ListChecks className="h-4 w-4" />} tone="bg-primary/10 text-primary">
            <ul className="space-y-1.5">
              {notes.keyPoints.map((k, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">{i + 1}</span>
                  <span>{k}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {notes.sections.map((s, i) => (
          <Card key={i} title={s.heading} icon={<BookMarked className="h-4 w-4" />} tone="bg-secondary text-foreground">
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </Card>
        ))}

        {notes.formulas.length > 0 && (
          <Card title="Formulas & facts to remember" icon={<Sigma className="h-4 w-4" />} tone="bg-accent/15 text-accent-foreground">
            <div className="flex flex-wrap gap-1.5">
              {notes.formulas.map((f, i) => (
                <span key={i} className="rounded-xl bg-muted px-2.5 py-1 font-mono text-[12px] font-bold">{f}</span>
              ))}
            </div>
          </Card>
        )}

        {notes.examples.map((ex, i) => (
          <Card key={i} title={`Solved example ${i + 1}`} icon={<Lightbulb className="h-4 w-4" />} tone="bg-primary/10 text-primary">
            <p className="text-sm font-bold">{ex.question}</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{ex.solution}</p>
          </Card>
        ))}

        {notes.examTips.length > 0 && (
          <Card title="Exam tips" icon={<Target className="h-4 w-4" />} tone="bg-secondary text-foreground">
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {notes.examTips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </Card>
        )}

        {/* Doubt chat */}
        <Card title="Ask your doubt" icon={<MessageCircleQuestion className="h-4 w-4" />} tone="bg-primary/10 text-primary">
          <div className="space-y-2">
            {chat.map((m, i) => (
              <div
                key={i}
                className={`max-w-[92%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                  m.role === "user" ? "ml-auto bg-gradient-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {m.content}
              </div>
            ))}
            {doubtMut.isPending && (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Teacher is writing…
              </div>
            )}
            {chat.length === 0 && !doubtMut.isPending && (
              <p className="text-xs text-muted-foreground">Ask anything from this chapter — “explain again with an example”, “why does this formula work?”</p>
            )}
          </div>
          <form onSubmit={sendDoubt} className="mt-3 flex gap-2">
            <Input value={doubt} onChange={(e) => setDoubt(e.target.value)} placeholder="Type your doubt…" />
            <Button type="submit" className="bg-gradient-primary" disabled={doubtMut.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        {notes.nextTopics.length > 0 && (
          <Card title="Learn next" icon={<Sparkles className="h-4 w-4" />} tone="bg-secondary text-foreground">
            <div className="flex flex-wrap gap-1.5">
              {notes.nextTopics.map((t) => (
                <button key={t} type="button" onClick={() => openTopic(t)} className="press rounded-full bg-muted px-3 py-1 text-[11px] font-bold">
                  {t}
                </button>
              ))}
            </div>
          </Card>
        )}
      </AppShell>
    );
  }

  /* ---------------- Picker ---------------- */
  const subjects = className ? subjectsForClass(className) : [];

  return (
    <AppShell>
      <section className="overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-lift animate-rise-in">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-90">
          <NotebookPen className="h-3.5 w-3.5" /> Class Notes 1–12
        </div>
        <h1 className="mt-1 text-2xl font-black leading-tight">Notes of every class, every board</h1>
        <p className="mt-1 text-sm opacity-90">Pick your board, class and subject — then read the notes and ask any doubt. Guru.AI explains like your own teacher.</p>
        <div className="mt-4 flex items-center gap-2">
          <Languages className="h-4 w-4 opacity-90" />
          {(["en", "hi"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              className={`press rounded-full px-3 py-1 text-[11px] font-bold ${language === l ? "bg-primary-foreground text-primary" : "bg-primary-foreground/20"}`}
            >
              {l === "en" ? "English" : "हिन्दी"}
            </button>
          ))}
        </div>
      </section>

      <Step n={1} label="Choose your board" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {NOTES_BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => { setBoard(b.name); setSubject(""); setChapters([]); }}
            className={`press card-lift rounded-2xl p-3 text-left shadow-soft ${
              board === b.name ? `bg-gradient-to-br ${gradientFor(b.id)} text-primary-foreground` : "bg-card"
            }`}
          >
            <div className="text-xl">{b.emoji}</div>
            <div className="mt-1 text-xs font-black leading-tight">{b.name}</div>
          </button>
        ))}
      </div>

      {board && (
        <>
          <Step n={2} label="Choose your class" />
          <div className="flex flex-wrap gap-2">
            {NOTES_CLASSES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setClassName(c); setSubject(""); setChapters([]); }}
                className={`press grid h-12 w-12 place-items-center rounded-2xl text-sm font-black shadow-soft ${
                  className === c ? `bg-gradient-to-br ${gradientFor("c" + c)} text-primary-foreground` : "bg-card"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </>
      )}

      {className && (
        <>
          <Step n={3} label="Choose a subject" />
          <div className="grid gap-2 sm:grid-cols-2">
            {subjects.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setSubject(s); setChapters([]); chapterMut.mutate({ subject: s }); }}
                className={`press card-lift rounded-2xl p-3 text-left shadow-soft ${
                  subject === s ? `bg-gradient-to-br ${gradientFor(s)} text-primary-foreground` : "bg-card"
                }`}
              >
                <div className="text-sm font-black">{s}</div>
                <div className={`text-[11px] ${subject === s ? "opacity-90" : "text-muted-foreground"}`}>Class {className} • {board}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {subject && (
        <>
          <Step n={4} label="Open a chapter, or type any topic" />
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); if (topic.trim().length > 1) openTopic(topic.trim()); }}
          >
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Light — Reflection and Refraction" />
            <Button type="submit" className="bg-gradient-primary" disabled={notesMut.isPending}>
              {notesMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-3 grid gap-2">
            {chapterMut.isPending && (
              <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">Loading syllabus chapters…</div>
            )}
            {chapters.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => openTopic(c)}
                className="press card-lift flex items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-soft"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${gradientFor(c)} text-sm font-black text-primary-foreground`}>
                  {i + 1}
                </span>
                <span className="min-w-0 text-sm font-bold">{c}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {notesMut.isPending && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Writing your notes…
        </div>
      )}
    </AppShell>
  );
}

function Step({ n, label }: { n: number; label: string }) {
  return (
    <h2 className="mb-2 mt-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">{n}</span>
      {label}
    </h2>
  );
}

function Card({ title, icon, tone, children }: { title: string; icon: React.ReactNode; tone: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 rounded-3xl bg-card p-4 shadow-soft">
      <h2 className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${tone}`}>
        {icon} {title}
      </h2>
      {children}
    </section>
  );
}
