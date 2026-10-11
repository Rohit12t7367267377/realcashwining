import { describe, expect, it } from "vitest";
import { classNumber, schoolSubjects, seniorStudyOutline, officialBoardUrl } from "./school-curriculum";

describe("school curriculum selection", () => {
  it("provides precisely the requested UP Board Class 12 PCM subjects", () => {
    expect(schoolSubjects("UP Board", 12)).toEqual(["Mathematics", "Physics", "Chemistry", "Hindi", "English"]);
  });
  it("changes subjects across class levels and streams", () => {
    expect(schoolSubjects("UP Board", 1)).not.toContain("Physics");
    expect(schoolSubjects("UP Board", 5)).toContain("Environmental Studies");
    expect(schoolSubjects("UP Board", 12, "pcb")).toContain("Biology");
    expect(schoolSubjects("UP Board", 12, "pcb")).not.toContain("Mathematics");
  });
  it("uses board-specific choices and rejects invalid classes", () => {
    expect(schoolSubjects("Maharashtra Board", 5)).toContain("Marathi");
    expect(schoolSubjects("ICSE", 10)).toContain("English Literature");
    expect(schoolSubjects("UP Board", 0)).toEqual([]);
    expect(classNumber("Class 12")).toBe(12);
  });
  it("keeps study outlines separate from official sources", () => {
    expect(seniorStudyOutline(12, "Mathematics")).toContain("Matrices");
    expect(seniorStudyOutline(12, "Hindi")).toBeUndefined();
    expect(officialBoardUrl("UP Board")).toBe("https://upmsp.edu.in/");
  });
});