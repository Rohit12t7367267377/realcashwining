import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/lib/user-store";
import { getGuruLibrary, getGuruBook } from "@/lib/guru-hub.functions";
import {
  guruListResources,
  guruResourceFilters,
  guruAskResource,
  RESOURCE_TYPES,
  type LibraryResource,
} from "@/lib/guru-library.functions";
import {
  ArrowLeft, BookOpen, Library as LibraryIcon, Search, SlidersHorizontal, ExternalLink,
  Sparkles, ShieldCheck, Loader2,
} from "lucide-react";

export const Route = createFileRoute("/guru/library")({
  head: () => ({
    meta: [
      { title: "Guru.AI Library — Books, Notes & Study Resources" },
      { name: "description", content: "Search legally available books, notes, reference and study material by class, board, subject, degree, semester, exam, language and topic — then learn it with your AI teacher." },
      { property: "og:title", content: "Guru.AI Library" },
      { property: "og:description", content: "Class-wise, subject-wise, degree-wise and exam-wise study material, all AI-taught." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuruLibraryPage,
});

type Filters = {
  resource_type?: string;
  board?: string;
  class_name?: string;
  subject?: string;
  degree?: string;
  semester?: string;
  exam?: string;
  language?: string;
  topic?: string;
};

const TYPE_META = new Map<string, { value: string; label: string; emoji: string }>(
  RESOURCE_TYPES.map((t) => [t.value as string, { value: t.value as string, label: t.label as string, emoji: t.emoji as string }]),
);

function Select({
  label, value, options, onChange,
}: { label: string; value?: string; options: string[]; onChange: (v: string | undefined) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="mt-1 w-full rounded-xl border border-border bg-background px-2 py-2 text-xs font-semibold"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function GuruLibraryPage() {
  const { state } = useUser();
  const listResources = useServerFn(guruListResources);
  const loadFilters = useServerFn(guruResourceFilters);
  const loadBooks = useServerFn(getGuruLibrary);
  const loadBook = useServerFn(getGuruBook);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [openResource, setOpenResource] = useState<LibraryResource | null>(null);
  const [openBook, setOpenBook] = useState<{ id: string; title: string } | null>(null);

  const { data: facets } = useQuery({
    queryKey: ["guru-resource-filters"],
    queryFn: () => loadFilters(),
    enabled: state.loggedIn,
  });

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["guru-resources", query, filters],
    queryFn: () => listResources({ data: { ...filters, ...(query ? { search: query } : {}), limit: 120 } }),
    enabled: state.loggedIn,
  });

  const { data: books = [] } = useQuery({
    queryKey: ["guru-library-books", query],
    queryFn: () => loadBooks({ data: query ? { search: query } : {} }),
    enabled: state.loggedIn,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["guru-book", openBook?.id],
    queryFn: () => loadBook({ data: { book_id: openBook!.id } }),
    enabled: Boolean(openBook?.id),
  });

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, LibraryResource[]>();
    for (const r of resources) {
      const list = map.get(r.resource_type) ?? [];
      list.push(r);
      map.set(r.resource_type, list);
    }
    return map;
  }, [resources]);

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

  if (openResource) {
    return (
      <AppShell>
        <ResourceView resource={openResource} onBack={() => setOpenResource(null)} />
      </AppShell>
    );
  }

  if (openBook) {
    return (
      <AppShell>
        <button type="button" onClick={() => setOpenBook(null)} className="press mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Library
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
        <h1 className="mt-1 text-2xl font-black">Books, notes & study resources</h1>
        <p className="mt-1 text-sm opacity-90">
          Class-wise, subject-wise, degree-wise and exam-wise material — legally open sources only, taught by your AI teacher.
        </p>
      </section>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}
      >
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search books, notes, topics, authors…" />
        <Button type="submit" className="bg-gradient-primary"><Search className="h-4 w-4" /></Button>
        <Button type="button" variant="secondary" onClick={() => setShowFilters((v) => !v)} className="relative">
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-black text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </form>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, resource_type: undefined }))}
          className={`press shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${!filters.resource_type ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"}`}
        >
          All
        </button>
        {RESOURCE_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilters((f) => ({ ...f, resource_type: f.resource_type === t.value ? undefined : t.value }))}
            className={`press shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${filters.resource_type === t.value ? "bg-gradient-primary text-primary-foreground" : "bg-secondary"}`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {showFilters && (
        <section className="mt-3 rounded-3xl bg-card p-4 shadow-soft">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Select label="Class" value={filters.class_name} options={facets?.classes ?? []} onChange={(v) => setFilters((f) => ({ ...f, class_name: v }))} />
            <Select label="Board" value={filters.board} options={facets?.boards ?? []} onChange={(v) => setFilters((f) => ({ ...f, board: v }))} />
            <Select label="Subject" value={filters.subject} options={facets?.subjects ?? []} onChange={(v) => setFilters((f) => ({ ...f, subject: v }))} />
            <Select label="Degree" value={filters.degree} options={facets?.degrees ?? []} onChange={(v) => setFilters((f) => ({ ...f, degree: v }))} />
            <Select label="Semester" value={filters.semester} options={facets?.semesters ?? []} onChange={(v) => setFilters((f) => ({ ...f, semester: v }))} />
            <Select label="Exam" value={filters.exam} options={facets?.exams ?? []} onChange={(v) => setFilters((f) => ({ ...f, exam: v }))} />
            <Select label="Language" value={filters.language} options={facets?.languages ?? []} onChange={(v) => setFilters((f) => ({ ...f, language: v }))} />
            <label className="block col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Topic</span>
              <Input
                value={filters.topic ?? ""}
                onChange={(e) => setFilters((f) => ({ ...f, topic: e.target.value || undefined }))}
                placeholder="e.g. Trigonometry"
                className="mt-1 h-9 text-xs"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setFilters({})}>Clear all filters</Button>
          </div>
        </section>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {isLoading && <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft">Loading library…</div>}
        {Array.from(grouped.entries()).flatMap(([type, list]) => [
          <div key={`h-${type}`} className="sm:col-span-2 mt-1 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
            {TYPE_META.get(type)?.emoji ?? "📄"} {TYPE_META.get(type)?.label ?? type}
          </div>,
          ...list.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpenResource(r)}
              className="press card-lift rounded-2xl bg-card p-3 text-left shadow-soft"
            >
              <div className="flex gap-3">
                {r.cover_url ? (
                  <img src={r.cover_url} alt={`${r.title} cover`} loading="lazy" className="h-16 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-16 w-12 shrink-0 place-items-center rounded-lg bg-secondary text-xl">
                    {TYPE_META.get(r.resource_type)?.emoji ?? "📄"}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-black">{r.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {[r.author, r.publisher].filter(Boolean).join(" • ") || r.source_name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {[r.board, r.class_name, r.degree, r.semester, r.subject, r.exam, r.language === "hi" ? "हिंदी" : "English"]
                      .filter(Boolean)
                      .slice(0, 4)
                      .map((chip) => (
                        <span key={String(chip)} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{chip}</span>
                      ))}
                  </div>
                </div>
              </div>
            </button>
          )),
        ])}
        {!isLoading && resources.length === 0 && (
          <div className="rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-soft sm:col-span-2">
            Nothing matched these filters yet.
          </div>
        )}
      </div>

      {books.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-black">Curriculum books (chapter → topic)</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
          </div>
        </section>
      )}
    </AppShell>
  );
}

function ResourceView({ resource, onBack }: { resource: LibraryResource; onBack: () => void }) {
  const ask = useServerFn(guruAskResource);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ text: string; grounded: boolean; sources: { id: string; title: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (intent: "doubt" | "learn" | "simple" | "practice" | "revise", q?: string) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setBusy(true); setError(""); setAnswer(null);
    try {
      const res = await ask({ data: { resource_id: resource.id, question: text, intent, language: resource.language === "hi" ? "hi" : "en" } });
      setAnswer({ text: res.answer, grounded: res.grounded, sources: res.sources });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not answer right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={onBack} className="press mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Library
      </button>

      <section className="rounded-3xl bg-card p-4 shadow-soft">
        <div className="flex gap-3">
          {resource.cover_url ? (
            <img src={resource.cover_url} alt={`${resource.title} cover`} className="h-24 w-18 rounded-xl object-cover" />
          ) : (
            <span className="grid h-24 w-16 place-items-center rounded-xl bg-secondary text-3xl">
              {TYPE_META.get(resource.resource_type)?.emoji ?? "📄"}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-lg font-black leading-tight">{resource.title}</h1>
            <p className="text-[11px] text-muted-foreground">
              {[resource.author, resource.publisher, resource.isbn ? `ISBN ${resource.isbn}` : null].filter(Boolean).join(" • ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {[resource.board, resource.class_name, resource.degree, resource.semester, resource.subject, resource.chapter, resource.topic, resource.exam]
                .filter(Boolean)
                .map((chip) => (
                  <span key={String(chip)} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{chip}</span>
                ))}
            </div>
          </div>
        </div>

        {resource.description && <p className="mt-3 text-sm text-muted-foreground">{resource.description}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {resource.source_url && (
            <a href={resource.source_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-gradient-primary">
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open at {resource.source_name || "source"}
              </Button>
            </a>
          )}
          {resource.tags.map((t) => (
            <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">#{t}</span>
          ))}
        </div>

        {(resource.license || resource.source_name) && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-secondary/60 p-2 text-[10px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              {resource.license ? `Licence: ${resource.license}. ` : ""}
              Hosted by {resource.source_name || "its publisher"} — Guru.AI links to the authorised source and never redistributes copyrighted files.
            </span>
          </p>
        )}
      </section>

      <section className="mt-4 rounded-3xl bg-card p-4 shadow-soft">
        <h2 className="flex items-center gap-1.5 text-sm font-black">
          <Sparkles className="h-4 w-4 text-primary" /> Learn this with your AI teacher
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {resource.chunk_count > 0
            ? "This resource is indexed — answers are retrieved from its material first."
            : "Ask anything about this resource; the AI teacher will explain it at your level."}
        </p>

        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a doubt from this resource… e.g. Explain Newton's second law with an example"
          className="mt-3 min-h-20 text-sm"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button size="sm" className="bg-gradient-primary" disabled={busy} onClick={() => submit("doubt")}>
            {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null} Ask
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => submit("simple", question || `Explain ${resource.title} simply`)}>Explain simply</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => submit("learn", question || `Teach me from ${resource.title} step by step`)}>Teach step by step</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => submit("practice", question || `Give practice questions from ${resource.title}`)}>Practice</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => submit("revise", question || `Give a revision sheet for ${resource.title}`)}>Revise</Button>
        </div>

        {error && <p className="mt-3 rounded-xl bg-destructive/10 p-2 text-xs font-semibold text-destructive">{error}</p>}
        {answer && (
          <article className="mt-3 rounded-2xl bg-secondary/50 p-3">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer.text}</div>
            {answer.sources.length > 0 && (
              <div className="mt-2 text-[10px] text-muted-foreground">
                Retrieved from: {answer.sources.map((s) => s.title).join(", ")}
              </div>
            )}
            {!answer.grounded && (
              <div className="mt-2 text-[10px] text-muted-foreground">
                No indexed extract for this resource yet — answered from general knowledge.
              </div>
            )}
          </article>
        )}
      </section>
    </>
  );
}
