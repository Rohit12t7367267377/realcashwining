import { describe, expect, it } from "vitest";
import { reviewFlags, type ReviewAttempt } from "./contest-review";

const at = (id: string, user: string, p: Partial<ReviewAttempt> = {}): ReviewAttempt => ({
  id, userId: user, startedAt: "2026-10-20T10:00:00Z", submittedAt: "2026-10-20T10:20:00Z", violations: 0, fingerprint: null, ip: null,
  answers: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1], ...p,
});
const codes = (f: ReturnType<typeof reviewFlags>) => f.map((x) => x.code).sort();

describe("anti-cheat review flags", () => {
  it("flags tab switching and impossibly fast finishes", () => {
    const f = reviewFlags([at("a", "u1", { violations: 4 }), at("b", "u2", { submittedAt: "2026-10-20T10:00:10Z", answers: [3,3,2,2,1,1,0,0,3,1] })], { numQuestions: 10 });
    expect(codes(f)).toEqual(["too_fast", "tab_switching"].sort());
  });
  it("flags shared device and identical long answer sheets across different users only", () => {
    const f = reviewFlags([at("a", "u1", { fingerprint: "fp1", answers: [0,1,2,3,0,1,2,3,0,1] }), at("b", "u2", { fingerprint: "fp1", answers: [0,1,2,3,0,1,2,3,0,1] }), at("c", "u3", { answers: [3,3,3,3,3,3,3,3,3,3] })], { numQuestions: 10 });
    expect(codes(f)).toEqual(["identical_answers", "identical_answers", "shared_device", "shared_device"]);
  });
  it("does not flag one user's own repeated device, nor identical short sheets", () => {
    const f = reviewFlags([at("a", "u1", { fingerprint: "fp", answers: [0, 1] }), at("b", "u1", { fingerprint: "fp", answers: [0, 1] })], { numQuestions: 2 });
    expect(f).toEqual([]);
  });
  it("shared IP needs three accounts", () => {
    const two = reviewFlags([at("a", "u1", { ip: "1.1.1.1" }), at("b", "u2", { ip: "1.1.1.1", answers: [1,1,1,1,1,1,1,1,1,1] })], { numQuestions: 10 });
    expect(two.some((x) => x.code === "shared_ip")).toBe(false);
    const three = reviewFlags([at("a", "u1", { ip: "9.9.9.9" }), at("b", "u2", { ip: "9.9.9.9", answers: [1,1,1,1,1,1,1,1,1,1] }), at("c", "u3", { ip: "9.9.9.9", answers: [2,2,2,2,2,2,2,2,2,2] })], { numQuestions: 10 });
    expect(three.filter((x) => x.code === "shared_ip")).toHaveLength(3);
  });
});
