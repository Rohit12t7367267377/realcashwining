import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseClassroomPreferences, classroomPreferencesSchema, DEFAULT_CLASSROOM_PREFERENCES } from "./classroom-preferences";
import { normalizeBoardBlocks } from "./guru-board-blocks";
import { lessonSegments } from "./lesson-segments";
import { buildPlan, contextOf, dedupeQuestions, defaultPlan, summariseBlocks, validateSection, SECTION_SPECS } from "./lesson-sections";

const callAiChat = vi.fn();
// A plain (non-spy) failing provider: vitest spies track rejected results and flag them as unhandled even when the code under test handles them.
let failing: (() => Promise<string>) | null = null;
vi.mock("@/lib/ai-gateway.server", async () => {
  const real = await vi.importActual<typeof import("./ai-gateway.server")>("./ai-gateway.server");
  return { ...real, callAiChat: (...a: unknown[]) => (failing ? failing() : callAiChat(...a)) };
});
vi.mock("@/lib/guru-rag.server", () => ({ retrieveGuruContext: vi.fn(), formatSources: vi.fn(() => "") }));

describe("teacher/board preferences", () => {
  it("defaults to a visible, medium teacher and keeps old saved settings valid", () => {
    expect(DEFAULT_CLASSROOM_PREFERENCES.teacherVisible).toBe(true);
    expect(DEFAULT_CLASSROOM_PREFERENCES.teacherSize).toBe("medium");
    const old = parseClassroomPreferences({ preset: "green", fontSize: 20 });
    expect(old.preset).toBe("green");
    expect(old.fontSize).toBe(20);
    expect(old.teacherVisible).toBe(true);
  });
  it("saves teacher visibility independently of the board settings", () => {
    const hidden = parseClassroomPreferences({ teacherVisible: false });
    expect(hidden.teacherVisible).toBe(false);
    expect(hidden.preset).toBe(DEFAULT_CLASSROOM_PREFERENCES.preset);
    expect(classroomPreferencesSchema.safeParse({ teacherSize: "huge" }).success).toBe(false);
    expect(classroomPreferencesSchema.safeParse({ teacherVisible: "no" }).success).toBe(false);
  });
});

describe("board blocks keep full explanations", () => {
  it("does not cut a 700-character explanation, long steps, or diagram part notes", () => {
    const long = "x".repeat(700);
    const [t, st, d] = normalizeBoardBlocks([
      { type: "text", text: long },
      { type: "steps", items: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"] },
      { type: "diagram", nodes: ["Lens", "Image"], parts: [{ label: "Lens", note: "bends light" }, { label: "", note: "dropped" }] },
    ], 12);
    expect(t && t.type === "text" && t.text.length).toBe(700);
    expect(st && st.type === "steps" && st.items.length).toBe(12);
    expect(d && d.type === "diagram" && d.parts).toEqual([{ label: "Lens", note: "bends light" }]);
  });
  it("narrates diagram part explanations so voice and board stay consistent", () => {
    const [seg] = lessonSegments("optics", [{ type: "diagram", caption: "Lens", nodes: ["Object", "Lens"], parts: [{ label: "Lens", note: "bends light" }] }]);
    expect(seg?.narration).toContain("Lens: bends light");
  });
});

describe("textbook plan", () => {
  it("never drops required sections, even if the model omits them", () => {
    const plan = buildPlan([{ kind: "intro", title: "Why waves?" }]);
    const kinds = plan.map((p) => p.kind);
    for (const s of SECTION_SPECS.filter((x) => x.required)) expect(kinds).toContain(s.kind);
    expect(plan.find((p) => p.kind === "intro")?.title).toBe("Why waves?");
  });
  it("keeps optional sections only when the model says they apply, in textbook order", () => {
    const withDeriv = buildPlan([{ kind: "derivation", title: "Derive v = u + at" }, { kind: "numericals", title: "Numericals" }]).map((p) => p.kind);
    expect(withDeriv).toContain("derivation");
    expect(withDeriv.indexOf("theory")).toBeLessThan(withDeriv.indexOf("derivation"));
    expect(withDeriv.indexOf("derivation")).toBeLessThan(withDeriv.indexOf("examples"));
    expect(buildPlan(undefined).map((p) => p.kind)).not.toContain("derivation");
    expect(buildPlan("garbage")).toEqual(defaultPlan());
  });
});

describe("section validation", () => {
  it("flags a section that is too short or lacks its required block types", () => {
    expect(validateSection("derivation", [{ type: "text", text: "Start" }]).ok).toBe(false);
    expect(validateSection("derivation", [{ type: "text", text: "Define symbols" }, { type: "steps", items: ["s1", "s2"] }]).ok).toBe(true);
    expect(validateSection("examples", [{ type: "text", text: "a" }, { type: "text", text: "b" }]).problems.join()).toContain("example or steps");
    expect(validateSection("examples", [{ type: "example", body: "x" }, { type: "steps", items: ["only one"] }]).problems.join()).toContain("fewer than 2 steps");
  });
});

describe("context and practice de-duplication", () => {
  it("keeps context bounded and informative", () => {
    const prev = Array.from({ length: 12 }, (_, i) => ({ title: `S${i}`, kind: "theory", text: "y".repeat(400) }));
    expect(contextOf(prev, 2600).length).toBeLessThanOrEqual(2600);
    expect(summariseBlocks([{ type: "heading", text: "Velocity" }, { type: "formula", text: "v = u + at", label: "First equation" }])).toContain("v = u + at");
  });
  it("drops exact and near-identical repeats", () => {
    const seen = ["A car accelerates from rest at 2 m/s^2 for 5 s. Find its final speed."];
    const fresh = [
      { prompt: "A car accelerates from rest at 2 m/s^2 for 5 s. Find its final speed!" },
      { prompt: "A ball is thrown upward at 20 m/s. How high does it rise?" },
      { prompt: "A ball is thrown upward at 20 m/s. How high does it rise" },
    ];
    expect(dedupeQuestions(fresh, seen).map((q) => q.prompt)).toEqual(["A ball is thrown upward at 20 m/s. How high does it rise?"]);
  });
});

describe("section generation pipeline (AI mocked)", () => {
  beforeEach(() => { callAiChat.mockReset(); failing = null; });
  const resolved = { teacher: { name: "Guru" }, language: "en", styleDirective: "", toolkit: "", sources: "", config: null, level: 3, premium: false } as never;
  const ctx = { scope: "classroom" as const, topic: "Kinematics" };
  const plan = buildPlan([{ kind: "derivation", title: "Derive v = u + at", focus: "from a = dv/dt" }]);
  const idx = plan.findIndex((p) => p.kind === "derivation");

  it("marks a complete section complete and passes earlier-section context to the model", async () => {
    const { runLessonSection } = await import("./guru-engine.server");
    callAiChat.mockResolvedValueOnce(JSON.stringify({ board: [{ type: "text", text: "Define a, v, u, t." }, { type: "steps", items: ["a = dv/dt", "integrate both sides"] }], question: null }));
    const res = await runLessonSection({ ctx, resolved, level: 3, plan, index: idx, previous: "[Core concepts] Velocity; v = u + at" });
    expect(res.status).toBe("complete");
    expect(callAiChat.mock.calls[0]?.[0][1].content).toContain("Already taught in earlier sections");
    expect(callAiChat.mock.calls[0]?.[0][1].content).toContain("v = u + at");
  });

  it("continues a short section once, then reports it as partial instead of complete", async () => {
    const { runLessonSection } = await import("./guru-engine.server");
    callAiChat.mockResolvedValueOnce(JSON.stringify({ board: [{ type: "text", text: "Define symbols." }] }));
    callAiChat.mockResolvedValueOnce(JSON.stringify({ board: [] }));
    const res = await runLessonSection({ ctx, resolved, level: 3, plan, index: idx, previous: "" });
    expect(callAiChat).toHaveBeenCalledTimes(2);
    expect(callAiChat.mock.calls[1]?.[0][1].content).toContain("only partly written");
    expect(res.status).toBe("partial");
    expect(res.board).toHaveLength(1);
    expect(res.problems.length).toBeGreaterThan(0);
  });

  it("completes through the continuation request and keeps both halves in order", async () => {
    const { runLessonSection } = await import("./guru-engine.server");
    callAiChat.mockResolvedValueOnce(JSON.stringify({ board: [{ type: "text", text: "Define symbols." }] }));
    callAiChat.mockResolvedValueOnce(JSON.stringify({ board: [{ type: "steps", items: ["step one", "step two"] }] }));
    const res = await runLessonSection({ ctx, resolved, level: 3, plan, index: idx, previous: "" });
    expect(res.status).toBe("complete");
    expect(res.board.map((b) => b.type)).toEqual(["text", "steps"]);
  });

  it("survives a provider error/timeout and returns a partial with the reason", async () => {
    const { runLessonSection } = await import("./guru-engine.server");
    failing = async () => { throw new Error("provider exploded: took too long"); };
    const res = await runLessonSection({ ctx, resolved, level: 3, plan, index: idx, previous: "" });
    expect(res.status).toBe("partial");
    expect(res.problems.join()).toContain("took too long");
  });

  it("requires a question for practice sections", async () => {
    const { runLessonSection } = await import("./guru-engine.server");
    const p = buildPlan([]);
    const i = p.findIndex((x) => x.kind === "practice");
    callAiChat.mockResolvedValue(JSON.stringify({ board: [{ type: "text", text: "Q1" }, { type: "text", text: "Q2" }], question: null }));
    expect((await runLessonSection({ ctx, resolved, level: 3, plan: p, index: i, previous: "" })).status).toBe("partial");
    callAiChat.mockResolvedValue(JSON.stringify({ board: [{ type: "text", text: "Q1" }, { type: "text", text: "Q2" }], question: { prompt: "Find v", hint: "use v=u+at", expected: "10 m/s" } }));
    const ok = await runLessonSection({ ctx, resolved, level: 3, plan: p, index: i, previous: "" });
    expect(ok.status).toBe("complete");
    expect(ok.question?.prompt).toBe("Find v");
  });

  it("falls back to the standard structure when the outline response is unusable", async () => {
    const { runLessonOutline } = await import("./guru-engine.server");
    callAiChat.mockResolvedValue("not json at all");
    const out = await runLessonOutline({ ctx, resolved });
    expect(out.fallback).toBe(true);
    expect(out.sections.map((s) => s.kind)).toEqual(defaultPlan().map((s) => s.kind));
  });

  it("practice sets drop repeats and unusable questions, and never exceed the requested count", async () => {
    const { runPracticeSet } = await import("./guru-engine.server");
    const q = (prompt: string) => ({ prompt, difficulty: "basic", kind: "numerical", hint: "h", steps: ["s1", "s2"], answer: "5 m/s" });
    callAiChat.mockResolvedValue(JSON.stringify({ questions: [q("Find v after 5 s at 2 m/s^2 from rest"), q("Find s when u=3 and t=4 and a=1"), { prompt: "no solution" }, q("Another unique one about displacement graphs")] }));
    const out = await runPracticeSet({ ctx, resolved, difficulty: "basic", kind: "numerical", count: 2, avoid: ["Find v after 5 s at 2 m/s^2 from rest"] });
    expect(out.map((x) => x.prompt)).toEqual(["Find s when u=3 and t=4 and a=1", "Another unique one about displacement graphs"]);
    expect(out.every((x) => x.steps.length && x.answer)).toBe(true);
  });
});
