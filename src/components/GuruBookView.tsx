import { useEffect, useRef, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw } from "lucide-react";
import { BoardBlockView } from "@/components/GuruBoardCanvas";
import type { BoardBlock } from "@/lib/guru-board-blocks";
import { DEFAULT_CLASSROOM_PREFERENCES, type ClassroomPreferences } from "@/lib/classroom-preferences";

export type BookSection = {
  id: string;
  title: string;
  status: "pending" | "loading" | "complete" | "partial" | "error";
  blocks: BoardBlock[];
  /** Index of this section's first block in the lesson-wide segment list. */
  start: number;
  problems?: string[];
};

/**
 * Book-style reading of the SAME lesson the teacher-led board shows: the sections and blocks come from
 * the classroom's single lesson state, and `position` is the shared segment index, so switching modes
 * never changes what the student was looking at.
 */
export function GuruBookView({
  title, sections, position, onPosition, preferences = DEFAULT_CLASSROOM_PREFERENCES, onRetry, busy,
}: {
  title: string;
  sections: BookSection[];
  position: number;
  onPosition: (segment: number) => void;
  preferences?: ClassroomPreferences;
  onRetry: (sectionIndex: number) => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);

  // Restore position when this view mounts or when the shared position is changed from elsewhere.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-segment="${position}"]`);
    if (!el) return;
    programmatic.current = true;
    el.scrollIntoView({ block: "start" });
    const t = setTimeout(() => { programmatic.current = false; }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections.length]);

  // Reading position follows what the student scrolls to.
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (programmatic.current) return;
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const n = Number((top?.target as HTMLElement | undefined)?.dataset.segment);
      if (Number.isFinite(n)) onPosition(n);
    }, { root, threshold: 0.6 });
    root.querySelectorAll("[data-segment]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections, onPosition]);

  const custom = {
    "--board-font-size": `${preferences.fontSize * preferences.zoom}px`,
    "--board-line-spacing": preferences.lineSpacing,
    ...(preferences.background ? { "--board-background": preferences.background } : {}),
    ...(preferences.foreground ? { "--board-foreground": preferences.foreground } : {}),
    ...(preferences.accent ? { "--board-accent": preferences.accent } : {}),
  } as CSSProperties;

  const go = (s: BookSection) => {
    programmatic.current = true;
    ref.current?.querySelector<HTMLElement>(`[data-section="${s.id}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    if (s.blocks.length) onPosition(s.start);
    setTimeout(() => { programmatic.current = false; }, 700);
  };
  const current = sections.findIndex((s, i) => position >= s.start && (i === sections.length - 1 || position < (sections[i + 1]?.start ?? Infinity)));

  return (
    <div className="learning-board book-view min-w-0 flex-1" data-preset={preferences.preset} data-font={preferences.font} data-density={preferences.density} style={custom} role="region" aria-label="Lesson book">
      <div className="board-header"><h2 className="min-w-0 break-words font-bold">{title}</h2></div>
      {sections.length > 0 && (
        <nav aria-label="Lesson sections" className="flex gap-1.5 overflow-x-auto py-2">
          {sections.map((s, i) => (
            <button key={s.id} type="button" onClick={() => go(s)} aria-current={i === current ? "true" : undefined}
              className={`board-label shrink-0 rounded-full px-3 py-1 text-xs font-bold ${i === current ? "ring-2 ring-[var(--board-accent)]" : "opacity-80"}`}>
              {i + 1}. {s.title}{s.status === "partial" || s.status === "error" ? " ⚠" : ""}
            </button>
          ))}
        </nav>
      )}
      <div ref={ref} className="board-content" tabIndex={0} aria-label="Lesson text">
        {sections.map((s, si) => (
          <section key={s.id} data-section={s.id} className="mb-6" aria-labelledby={`sec-${s.id}`}>
            <h3 id={`sec-${s.id}`} className="board-heading border-b border-current/20 pb-1 font-bold opacity-90">{si + 1}. {s.title}</h3>
            {s.blocks.map((b, bi) => (
              <div key={bi} data-segment={s.start + bi} className="board-segment" data-active={position === s.start + bi}>
                <BoardBlockView block={b} />
              </div>
            ))}
            {s.status === "loading" && <p className="mt-2 flex items-center gap-2 text-sm opacity-80"><Loader2 className="h-4 w-4 animate-spin" /> Writing this section…</p>}
            {s.status === "pending" && <p className="mt-2 text-sm opacity-60">Coming up next.</p>}
            {(s.status === "partial" || s.status === "error") && (
              <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span>This section is incomplete{s.problems?.length ? ` (${s.problems.join("; ")})` : ""}. It is not counted as covered.</span>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => onRetry(si)}><RotateCcw /> Continue this section</Button>
              </div>
            )}
          </section>
        ))}
        {sections.length === 0 && <p className="opacity-70">Choose a topic to begin.</p>}
      </div>
    </div>
  );
}
