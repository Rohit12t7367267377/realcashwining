import type { BoardBlock } from "@/lib/guru-board-blocks";

export type LessonSegment = { id: string; topicId: string; order: number; board: BoardBlock; narration: string };

/** Narration is projected from the exact displayed content, never unrelated AI speech. */
export function boardBlockText(block: BoardBlock): string {
  switch (block.type) {
    case "heading":
    case "text": return block.text;
    case "formula": return [block.label, block.text].filter(Boolean).join(": ");
    case "steps": return [block.title, ...block.items.map((item, i) => `${i + 1}. ${item}`)].filter(Boolean).join("\n");
    case "example": return [block.title, block.body].filter(Boolean).join("\n");
    case "code": return [block.language, block.code].filter(Boolean).join("\n");
    case "table": return [block.columns.join(", "), ...block.rows.map((row) => row.map((cell, i) => `${block.columns[i] ?? ""}: ${cell}`).join(", "))].join("\n");
    case "diagram": return [block.caption, block.nodes.join(block.arrows === false ? ", " : " → "), ...(block.parts ?? []).map((part) => `${part.label}: ${part.note}`)].filter(Boolean).join("\n");
    case "graph": return `${block.caption}. ${block.xLabel} versus ${block.yLabel}. ${block.basis}\n${block.points.map((p) => `${block.xLabel}: ${p.x}, ${block.yLabel}: ${p.y}`).join("; ")}`;
  }
}

/**
 * Segments for the board. `spoken` (optional) is the teacher's own friendly explanation, one entry per block.
 * A missing, empty or oversized entry falls back to the exact board text, so narration never goes silent or drifts off-topic.
 */
export function lessonSegments(topicId: string, board: BoardBlock[], spoken?: unknown): LessonSegment[] {
  const say = Array.isArray(spoken) ? spoken : [];
  return board.map((block, order) => {
    const s = typeof say[order] === "string" ? (say[order] as string).replace(/\s+/g, " ").trim() : "";
    const usable = s.length >= 12 && s.length <= 700 ? s : "";
    return { id: `${topicId}:segment:${order + 1}`, topicId, order, board: block, narration: usable || boardBlockText(block) };
  });
}