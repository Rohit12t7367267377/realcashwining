import { describe, expect, it } from "vitest";
import { canonicalBoard, canonicalClass } from "./school-curriculum";

describe("saved-content keys are the same for admin pre-generation and students", () => {
  it("maps every spelling of a class and board to one name", () => {
    expect(canonicalClass("Class 10")).toBe("10");
    expect(canonicalClass("10")).toBe("10");
    expect(canonicalBoard("Uttar Pradesh Board of High School and Intermediate Education")).toBe(canonicalBoard("UP Board"));
    expect(canonicalBoard("Central Board of Secondary Education (CBSE)")).toBe(canonicalBoard("CBSE"));
    expect(canonicalBoard("Bihar School Examination Board")).toBe(canonicalBoard("Bihar Board"));
    expect(canonicalBoard("Some Local Board")).toBe("Some Local Board");
  });
});
