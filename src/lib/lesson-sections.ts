import type { BoardBlock } from "@/lib/guru-board-blocks";
import { boardBlockText } from "@/lib/lesson-segments";

/**
 * Textbook structure used by the existing classroom pipeline. A topic is generated
 * one section per AI request so no single response has to carry the whole lesson.
 * `required` sections can never be dropped by the model; optional ones are kept only
 * when they apply to the topic (e.g. no derivation for a history topic).
 */
export type SectionKind =
  | "objectives" | "intro" | "concepts" | "theory" | "formulas" | "derivation"
  | "examples" | "numericals" | "mistakes" | "practice" | "recap" | "mastery";

export type SectionSpec = {
  kind: SectionKind;
  title: string;
  required: boolean;
  /** Minimum number of board blocks for the section to count as complete. */
  minBlocks: number;
  /** At least one of these block types must be present. */
  mustInclude?: BoardBlock["type"][];
  brief: string;
};

export const SECTION_SPECS: SectionSpec[] = [
  { kind: "objectives", title: "Learning objectives & prerequisites", required: true, minBlocks: 2, brief: "State 3-5 measurable learning objectives and the prerequisites the student needs, each with a one-line reminder." },
  { kind: "intro", title: "Introduction & intuition", required: true, minBlocks: 2, brief: "Explain the idea in plain language first, using a relatable situation, then say why the topic matters." },
  { kind: "concepts", title: "Core concepts & definitions", required: true, minBlocks: 3, mustInclude: ["text"], brief: "Define every key term precisely, one at a time. Include a labelled diagram or table when it clarifies the concepts, with the parts explained." },
  { kind: "theory", title: "Detailed theory", required: true, minBlocks: 3, brief: "Explain how and why it works. Connect each diagram to the written theory. Cover assumptions, conditions and exceptions." },
  { kind: "formulas", title: "Formulas, notation & units", required: false, minBlocks: 2, mustInclude: ["formula", "table"], brief: "List the important formulas, define every symbol, give units and the conditions under which each formula applies." },
  { kind: "derivation", title: "Step-by-step derivation", required: false, minBlocks: 2, mustInclude: ["steps", "formula"], brief: "Define symbols first, explain why the starting relation applies, then derive the result one justified step at a time." },
  { kind: "examples", title: "Worked examples", required: true, minBlocks: 2, mustInclude: ["example", "steps"], brief: "Give 2-3 fully worked examples from basic to advanced. Explain why each method is chosen before applying it." },
  { kind: "numericals", title: "Numerical problems", required: false, minBlocks: 2, mustInclude: ["steps", "example"], brief: "Solve numerical problems with given data, formula choice, substitution with units, intermediate calculations and a checked final answer." },
  { kind: "mistakes", title: "Common mistakes & exam traps", required: true, minBlocks: 1, brief: "List the most common conceptual and calculation mistakes and the exam-relevant observations, each with the correct approach." },
  { kind: "practice", title: "Practice questions", required: true, minBlocks: 2, brief: "Give graded practice questions from easy to hard WITHOUT the solutions on the board, and ask the first one as the question." },
  { kind: "recap", title: "Recap", required: true, minBlocks: 1, brief: "Recap the key concepts and every important formula in a compact form." },
  { kind: "mastery", title: "Mastery check", required: true, minBlocks: 1, brief: "Ask ONE question that exposes the most likely gap in understanding, and say which section to revisit if the student struggles." },
];

export type SectionPlanItem = { kind: SectionKind; title: string; focus: string; required: boolean };

export function specFor(kind: SectionKind): SectionSpec {
  return SECTION_SPECS.find((s) => s.kind === kind) ?? SECTION_SPECS[0]!;
}

/** Honest default plan when the model's outline is missing or unusable (structure only, no content). */
export function defaultPlan(): SectionPlanItem[] {
  return SECTION_SPECS.filter((s) => s.required).map((s) => ({ kind: s.kind, title: s.title, focus: "", required: true }));
}

/**
 * Merge the model's outline with the required structure. The model can pick which optional
 * sections apply and refine titles/focus, but cannot remove a required section.
 */
export function buildPlan(raw: unknown): SectionPlanItem[] {
  const items = Array.isArray(raw) ? raw : [];
  const picked = new Map<SectionKind, SectionPlanItem>();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const spec = SECTION_SPECS.find((s) => s.kind === o.kind);
    if (!spec || picked.has(spec.kind)) continue;
    picked.set(spec.kind, {
      kind: spec.kind,
      title: String(o.title ?? "").trim().slice(0, 90) || spec.title,
      focus: String(o.focus ?? "").trim().slice(0, 300),
      required: spec.required,
    });
  }
  return SECTION_SPECS.flatMap((spec) => {
    const hit = picked.get(spec.kind);
    if (hit) return [hit];
    return spec.required ? [{ kind: spec.kind, title: spec.title, focus: "", required: true }] : [];
  });
}

export type SectionCheck = { ok: boolean; problems: string[] };

/** Validates generated blocks against the section's requirements. */
export function validateSection(kind: SectionKind, blocks: BoardBlock[]): SectionCheck {
  const spec = specFor(kind);
  const problems: string[] = [];
  if (blocks.length < spec.minBlocks) problems.push(`needs at least ${spec.minBlocks} board blocks, got ${blocks.length}`);
  if (spec.mustInclude && !blocks.some((b) => spec.mustInclude!.includes(b.type))) {
    problems.push(`needs a ${spec.mustInclude.join(" or ")} block`);
  }
  for (const b of blocks) {
    if (b.type === "steps" && b.items.length < 2) { problems.push("a steps block has fewer than 2 steps"); break; }
  }
  return { ok: problems.length === 0, problems };
}

export type SectionSummary = { title: string; kind: string; text: string };

/** Compact, bounded context of what earlier sections already taught (headings, formulas, key lines). */
export function contextOf(previous: SectionSummary[], limit = 2600): string {
  const parts = previous.map((p) => `[${p.title}] ${p.text}`);
  let out = parts.join("\n");
  if (out.length > limit) out = parts.map((p) => p.slice(0, 260)).join("\n").slice(-limit);
  return out;
}

/** One-line digest of a section's blocks used as context for the next section. */
export function summariseBlocks(blocks: BoardBlock[], max = 420): string {
  const bits: string[] = [];
  for (const b of blocks) {
    if (b.type === "heading" || b.type === "formula") bits.push(boardBlockText(b).replace(/\s+/g, " "));
    else if (b.type === "text" && b.highlight) bits.push(b.text);
  }
  const base = bits.length ? bits.join("; ") : blocks.map((b) => boardBlockText(b).replace(/\s+/g, " ").slice(0, 80)).join("; ");
  return base.slice(0, max);
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Drops generated questions that repeat (exactly or nearly) something the student already saw. */
export function dedupeQuestions<T extends { prompt: string }>(fresh: T[], seen: string[]): T[] {
  const known = new Set(seen.map(norm));
  const tokens = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2));
  const knownTokens = seen.map(tokens);
  const out: T[] = [];
  for (const q of fresh) {
    const n = norm(q.prompt);
    if (!n || known.has(n)) continue;
    const t = tokens(q.prompt);
    const near = [...knownTokens, ...out.map((o) => tokens(o.prompt))].some((k) => {
      if (!k.size || !t.size) return false;
      let shared = 0;
      for (const w of t) if (k.has(w)) shared += 1;
      return shared / Math.min(k.size, t.size) >= 0.9;
    });
    if (near) continue;
    known.add(n);
    out.push(q);
  }
  return out;
}
