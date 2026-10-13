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
    case "diagram": return [block.caption, block.nodes.join(block.arrows === false ? ", " : " → ")].filter(Boolean).join("\n");
  }
}

export function lessonSegments(topicId: string, board: BoardBlock[]): LessonSegment[] {
  return board.map((block, order) => ({ id: `${topicId}:segment:${order + 1}`, topicId, order, board: block, narration: boardBlockText(block) }));
}