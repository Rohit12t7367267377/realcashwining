import { describe, expect, it } from "vitest";
import { contrastRatio, parseClassroomPreferences, classroomPreferencesSchema } from "./classroom-preferences";
import { lessonSegments } from "./lesson-segments";

describe("classroom content and preferences", () => {
  it("derives ordered narration from the same formula and explanation as the board", () => {
    const segments = lessonSegments("newton-2", [
      { type: "formula", label: "Newton's Second Law", text: "F = ma" },
      { type: "text", text: "Force equals mass multiplied by acceleration." },
    ]);
    expect(segments[0]?.narration).toBe("Newton's Second Law: F = ma");
    expect(segments[1]?.narration).toBe("Force equals mass multiplied by acceleration.");
    expect(segments.map((s) => s.order)).toEqual([0, 1]);
    expect(segments.every((s) => s.topicId === "newton-2")).toBe(true);
  });
  it("keeps table and process narration aligned with displayed labels", () => {
    const segments = lessonSegments("water", [
      { type: "diagram", nodes: ["Evaporation", "Condensation", "Rain"] },
      { type: "table", columns: ["Mass", "Force"], rows: [["2 kg", "6 N"]] },
    ]);
    expect(segments[0]?.narration).toContain("Evaporation → Condensation → Rain");
    expect(segments[1]?.narration).toContain("Mass: 2 kg, Force: 6 N");
  });
  it("rejects unsafe colors and oversized settings", () => {
    expect(classroomPreferencesSchema.safeParse({ background: "url(https://example.com)" }).success).toBe(false);
    expect(classroomPreferencesSchema.safeParse({ fontSize: 100 }).success).toBe(false);
    expect(parseClassroomPreferences({ zoom: 100 }).zoom).toBe(1);
  });
  it("computes readable custom-color contrast", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBe(21);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
  });
});