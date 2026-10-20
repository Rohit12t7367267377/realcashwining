import { describe, expect, it } from "vitest";
import { applyFilters, countdown, NO_FILTERS, statusOf, trackOf, type ExplorerContest } from "./contest-explorer";

const NOW = Date.parse("2026-10-20T10:00:00Z");
const mk = (p: Partial<ExplorerContest>): ExplorerContest => ({ id: "x", title: "t", contest_type: "free", entry_fee: 0, num_questions: 10, duration_minutes: 20, starts_at: null, ends_at: null, results_status: "pending", active: true, marks_correct: null, marks_wrong: null, auto_scope: null, ...p });
const live = mk({ id: "live", starts_at: "2026-10-20T09:00:00Z", ends_at: "2026-10-20T12:30:00Z", auto_scope: { track: "exam", subject: "Quant", difficulty: "hard" } });
const up = mk({ id: "up", starts_at: "2026-10-22T10:00:00Z", ends_at: "2026-10-22T13:00:00Z", auto_scope: { track: "school", subject: "Physics", className: "11", difficulty: "easy" } });
const done = mk({ id: "done", results_status: "declared" });
const code = mk({ id: "code", contest_type: "coding" });

describe("contest explorer", () => {
  it("derives status and track", () => {
    expect([live, up, done].map((c) => statusOf(c, NOW))).toEqual(["live", "upcoming", "ended"]);
    expect(trackOf(code)).toBe("coding"); expect(trackOf(live)).toBe("exam"); expect(trackOf(done)).toBe("other");
  });
  it("filters by status, track, difficulty and search", () => {
    const all = [live, up, done, code];
    expect(applyFilters(all, { ...NO_FILTERS, status: "upcoming" }, NOW).map((c) => c.id)).toEqual(["up"]);
    expect(applyFilters(all, { ...NO_FILTERS, track: "coding" }, NOW).map((c) => c.id)).toEqual(["code"]);
    expect(applyFilters(all, { ...NO_FILTERS, difficulty: "hard" }, NOW).map((c) => c.id)).toEqual(["live"]);
    expect(applyFilters(all, { ...NO_FILTERS, subject: "physics" }, NOW).map((c) => c.id)).toEqual(["up"]);
  });
  it("formats countdowns", () => {
    expect(countdown(live, NOW)).toBe("Ends in 2h 30m");
    expect(countdown(up, NOW)).toBe("Starts in 2d 0h");
    expect(countdown(done, NOW)).toBe("Ended");
  });
});
