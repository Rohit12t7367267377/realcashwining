/**
 * Board block model — the AI teacher controls exactly what appears on the
 * interactive classroom board by emitting these blocks in order.
 */
export type BoardBlock =
  | { type: "heading"; text: string }
  | { type: "text"; text: string; highlight?: boolean }
  | { type: "formula"; text: string; label?: string }
  | { type: "steps"; title?: string; items: string[] }
  | { type: "example"; title?: string; body: string }
  | { type: "code"; language?: string; code: string }
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "diagram"; caption?: string; nodes: string[]; arrows?: boolean };

/** Coerces loose AI JSON into safe, renderable board blocks. */
export function normalizeBoardBlocks(input: unknown, limit = 12): BoardBlock[] {
  if (!Array.isArray(input)) return [];
  const out: BoardBlock[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const s = (v: unknown, max = 400) => String(v ?? "").trim().slice(0, max);
    const list = (v: unknown, max = 8) =>
      Array.isArray(v) ? v.map((x) => s(x, 240)).filter(Boolean).slice(0, max) : [];
    switch (s(b.type, 20)) {
      case "heading": {
        const text = s(b.text, 90);
        if (text) out.push({ type: "heading", text });
        break;
      }
      case "text": {
        const text = s(b.text, 400);
        if (text) out.push({ type: "text", text, highlight: Boolean(b.highlight) });
        break;
      }
      case "formula": {
        const text = s(b.text, 200);
        if (text) out.push({ type: "formula", text, label: b.label ? s(b.label, 60) : undefined });
        break;
      }
      case "steps": {
        const items = list(b.items, 10);
        if (items.length) out.push({ type: "steps", title: b.title ? s(b.title, 70) : undefined, items });
        break;
      }
      case "example": {
        const body = s(b.body, 600);
        if (body) out.push({ type: "example", title: b.title ? s(b.title, 70) : undefined, body });
        break;
      }
      case "code": {
        const code = s(b.code, 1200);
        if (code) out.push({ type: "code", language: b.language ? s(b.language, 20) : undefined, code });
        break;
      }
      case "table": {
        const columns = list(b.columns, 6);
        const rows = Array.isArray(b.rows)
          ? b.rows.map((r) => list(r, 6)).filter((r) => r.length).slice(0, 8)
          : [];
        if (columns.length && rows.length) out.push({ type: "table", columns, rows });
        break;
      }
      case "diagram": {
        const nodes = list(b.nodes, 6);
        if (nodes.length)
          out.push({
            type: "diagram",
            caption: b.caption ? s(b.caption, 90) : undefined,
            nodes,
            arrows: b.arrows === undefined ? true : Boolean(b.arrows),
          });
        break;
      }
      default:
        break;
    }
    if (out.length >= limit) break;
  }
  return out;
}
