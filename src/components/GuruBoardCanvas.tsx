import type { BoardBlock } from "@/lib/guru-board-blocks";

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
}: {
  title: string;
  blocks: BoardBlock[];
  revealed: number;
  stepLabel?: string | null;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-[hsl(150_35%_16%)] p-3 text-white shadow-lift ring-4 ring-[hsl(30_45%_35%)]">
      <div className="flex items-center justify-between gap-2 border-b border-white/25 pb-1.5">
        <div className="truncate text-sm font-black tracking-wide">{title}</div>
        {stepLabel ? (
          <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">{stepLabel}</span>
        ) : null}
      </div>

      <div className="mt-2 space-y-2">
        {blocks.slice(0, revealed).map((b, i) => (
          <div key={i} className="animate-rise-in">
            <Block block={b} />
          </div>
        ))}
        {revealed === 0 && (
          <p className="text-[13px] opacity-70">The board is clean. Pick a topic and press “Teach Me”…</p>
        )}
      </div>
    </div>
  );
}

function Block({ block }: { block: BoardBlock }) {
  switch (block.type) {
    case "heading":
      return <h3 className="text-[15px] font-black underline decoration-white/40 decoration-2 underline-offset-4">{block.text}</h3>;

    case "text":
      return (
        <p
          className={
            block.highlight
              ? "rounded-lg bg-yellow-300/25 px-2 py-1 text-[13px] font-semibold leading-snug ring-1 ring-yellow-200/50"
              : "text-[13px] leading-snug"
          }
        >
          {block.text}
        </p>
      );

    case "formula":
      return (
        <div className="rounded-xl bg-white/10 p-2 text-center ring-1 ring-white/25">
          {block.label ? <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">{block.label}</div> : null}
          <div className="font-mono text-[15px] font-bold tracking-wide">{block.text}</div>
        </div>
      );

    case "steps":
      return (
        <div>
          {block.title ? <div className="text-[11px] font-bold uppercase tracking-widest opacity-75">{block.title}</div> : null}
          <ol className="mt-1 space-y-1">
            {block.items.map((it, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white/20 text-[9px] font-black">{i + 1}</span>
                <span>{it}</span>
              </li>
            ))}
          </ol>
        </div>
      );

    case "example":
      return (
        <div className="rounded-xl border-l-4 border-emerald-300 bg-white/10 p-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">{block.title ?? "Example"}</div>
          <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-snug">{block.body}</p>
        </div>
      );

    case "code":
      return (
        <pre className="overflow-x-auto rounded-xl bg-black/45 p-2 text-[11.5px] leading-relaxed ring-1 ring-white/15">
          {block.language ? <div className="mb-1 text-[9px] font-bold uppercase tracking-widest opacity-60">{block.language}</div> : null}
          <code className="font-mono">{block.code}</code>
        </pre>
      );

    case "table":
      return (
        <div className="overflow-x-auto rounded-xl ring-1 ring-white/20">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-white/15">
                {block.columns.map((c, i) => (
                  <th key={i} className="px-2 py-1 text-left font-bold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r, ri) => (
                <tr key={ri} className="odd:bg-white/5">
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
        <div className="rounded-xl bg-white/8 p-2 ring-1 ring-white/20">
          {block.caption ? <div className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-70">{block.caption}</div> : null}
          <div className="flex flex-wrap items-center gap-1.5">
            {block.nodes.map((n, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="rounded-lg bg-sky-300/25 px-2 py-1 text-[12px] font-semibold ring-1 ring-sky-200/50">{n}</span>
                {block.arrows !== false && i < block.nodes.length - 1 ? <span className="text-sm opacity-70">→</span> : null}
              </span>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}
