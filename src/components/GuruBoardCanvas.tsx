import type { BoardBlock } from "@/lib/guru-board-blocks";
import { Component, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { LessonGraph } from "@/components/LessonGraph";
import { DEFAULT_CLASSROOM_PREFERENCES, type ClassroomPreferences } from "@/lib/classroom-preferences";

/**
 * The interactive AI teaching board. The AI character controls every block that
 * appears here: headings, text, formulas, steps, examples, code, tables and
 * simple flow diagrams. Blocks reveal one by one as the teacher speaks.
 */
export function GuruBoardCanvas({
  title,
  blocks,
  revealed,
  stepLabel,
  preferences = DEFAULT_CLASSROOM_PREFERENCES,
  activeSegment,
  loading = false,
  scrollToSegment,
}: {
  title: string;
  blocks: BoardBlock[];
  revealed: number;
  stepLabel?: string | null;
  preferences?: ClassroomPreferences;
  activeSegment?: number;
  loading?: boolean;
  /** When set, the board scrolls this segment into view (used to keep position across view/mode switches). */
  scrollToSegment?: number;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollToSegment === undefined) return;
    contentRef.current?.querySelector<HTMLElement>(`[data-segment="${scrollToSegment}"]`)?.scrollIntoView({ block: "nearest" });
  }, [scrollToSegment, revealed]);
  const custom = {
    "--board-font-size": `${preferences.fontSize * preferences.zoom}px`,
    "--board-line-spacing": preferences.lineSpacing,
    ...(preferences.background ? { "--board-background": preferences.background } : {}),
    ...(preferences.foreground ? { "--board-foreground": preferences.foreground } : {}),
    ...(preferences.accent ? { "--board-accent": preferences.accent } : {}),
  } as CSSProperties;
  return (
    <div className="learning-board min-w-0 flex-1" data-preset={preferences.preset} data-font={preferences.font} data-density={preferences.density} style={custom} role="region" aria-label="Teaching board" aria-busy={loading}>
      <div className="board-header flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 break-words font-bold">{title}</h2>
        {stepLabel ? (
          <span className="board-label shrink-0 px-2 py-1 text-xs font-bold">{stepLabel}</span>
        ) : null}
      </div>

      <div ref={contentRef} className="board-content" tabIndex={0} aria-label="Scrollable lesson content">
        {blocks.slice(0, revealed).map((b, i) => (
          <div key={i} data-segment={i} className="board-segment animate-rise-in" data-active={activeSegment === i} aria-current={activeSegment === i ? "step" : undefined}>
            <BoardBlockView block={b} />
          </div>
        ))}
        {revealed === 0 && (
          <p className="opacity-70">{loading ? "Preparing your lesson…" : "Choose a topic to begin."}</p>
        )}
      </div>
    </div>
  );
}

/** A broken block must never blank the board or show a misleading picture. */
class BlockGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p role="status" className="board-example rounded-lg p-3 text-sm opacity-80">This visual could not be drawn. The explanation around it is still correct.</p>
      : this.props.children;
  }
}

export function BoardBlockView({ block }: { block: BoardBlock }) {
  return <BlockGuard><Block block={block} /></BlockGuard>;
}

function Block({ block }: { block: BoardBlock }) {
  switch (block.type) {
    case "graph": return <LessonGraph graph={block} />;
    case "heading":
      return <h3 className="board-heading font-bold">{block.text}</h3>;

    case "text":
      return (
        <p
          className={
            block.highlight
              ? "board-highlight rounded-lg px-3 py-2 font-semibold"
              : "whitespace-pre-wrap"
          }
        >
          {block.text}
        </p>
      );

    case "formula":
      return (
        <div className="board-highlight rounded-lg p-3 text-center">
          {block.label ? <div className="text-xs font-bold opacity-70">{block.label}</div> : null}
          <div className="break-words font-mono font-bold">{block.text}</div>
        </div>
      );

    case "steps":
      return (
        <div>
          {block.title ? <div className="font-bold opacity-75">{block.title}</div> : null}
          <ol className="mt-1 space-y-1">
            {block.items.map((it, i) => (
              <li key={i} className="flex gap-3">
                <span className="board-label mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold">{i + 1}</span>
                <span className="min-w-0 break-words">{it}</span>
              </li>
            ))}
          </ol>
        </div>
      );

    case "example":
      return (
        <div className="board-example rounded-lg p-3">
          <div className="font-bold">{block.title ?? "Example"}</div>
          <p className="mt-1 whitespace-pre-wrap">{block.body}</p>
        </div>
      );

    case "code":
      return (
        <pre className="board-code overflow-x-auto rounded-lg p-3">
          {block.language ? <div className="mb-1 text-[9px] font-bold uppercase tracking-widest opacity-60">{block.language}</div> : null}
          <code className="font-mono">{block.code}</code>
        </pre>
      );

    case "table":
      return (
        <div className="board-table overflow-x-auto rounded-lg">
          <table className="w-full border-collapse">
            <thead>
              <tr className="board-label">
                {block.columns.map((c, i) => (
                  <th key={i} className="px-2 py-1 text-left font-bold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2 py-1 align-top">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "diagram":
      return (
        <div className="board-example rounded-lg p-3">
          {block.caption ? <div className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-70">{block.caption}</div> : null}
          <div className="flex flex-wrap items-center gap-1.5">
            {block.nodes.map((n, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="board-highlight rounded-lg px-3 py-2 font-semibold">{n}</span>
                {block.arrows !== false && i < block.nodes.length - 1 ? <span className="text-sm opacity-70">→</span> : null}
              </span>
            ))}
          </div>
          {block.parts?.length ? (
            <dl className="mt-2 space-y-1 text-[0.9em]">
              {block.parts.map((part, i) => (
                <div key={i} className="flex gap-2"><dt className="shrink-0 font-bold">{part.label}:</dt><dd className="min-w-0 break-words opacity-90">{part.note}</dd></div>
              ))}
            </dl>
          ) : null}
        </div>
      );

    default:
      return null;
  }
}
