import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BoardBlock } from "@/lib/guru-board-blocks";

export function LessonGraph({ graph }: { graph: Extract<BoardBlock, { type: "graph" }> }) {
  const valid = graph.points.length >= 2 && graph.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (!valid) return <p role="status" className="board-example rounded-lg p-3 text-sm opacity-80">{graph.caption}: not enough valid data to draw this graph.</p>;
  return <figure className="board-example rounded-lg p-3">
    <figcaption className="mb-2 font-bold">{graph.caption}</figcaption>
    <div className="graph-frame h-64 min-w-0" role="img" aria-label={`${graph.caption}. ${graph.xLabel} versus ${graph.yLabel}. ${graph.basis}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={graph.points} margin={{ top: 10, right: 20, bottom: 25, left: 15 }}>
          <CartesianGrid stroke="currentColor" opacity={0.15} />
          <XAxis type="number" dataKey="x" stroke="currentColor" label={{ value: graph.xLabel, position: "bottom", fill: "currentColor" }} />
          <YAxis type="number" dataKey="y" stroke="currentColor" label={{ value: graph.yLabel, angle: -90, position: "insideLeft", fill: "currentColor" }} />
          <Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded border border-border bg-background p-2 text-sm text-foreground">{graph.xLabel}: {payload[0].payload.x}<br />{graph.yLabel}: {payload[0].payload.y}</div> : null} />
          <Line type="linear" dataKey="y" stroke="var(--board-accent, var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <p className="mt-2 text-xs opacity-75">{graph.basis}</p>
    <details className="mt-2 text-xs"><summary className="cursor-pointer">Graph values</summary><table className="mt-2 w-full"><thead><tr><th>{graph.xLabel}</th><th>{graph.yLabel}</th></tr></thead><tbody>{graph.points.map((p, i) => <tr key={i}><td>{p.x}</td><td>{p.y}</td></tr>)}</tbody></table></details>
  </figure>;
}