/** Pure helpers for the student contest explorer: status, track, filters, countdown. */
export type ExplorerContest = {
  id: string; title: string; contest_type: string; entry_fee: number; num_questions: number; duration_minutes: number;
  starts_at: string | null; ends_at: string | null; results_status: string | null; active: boolean;
  marks_correct: number | null; marks_wrong: number | null;
  auto_scope: { track?: string; board?: string; className?: string; subject?: string; difficulty?: string; examPreset?: string } | null;
};
export type Status = "live" | "upcoming" | "ended";
export type Track = "school" | "college" | "exam" | "coding" | "other";

export function statusOf(c: ExplorerContest, now = Date.now()): Status {
  if (c.results_status === "declared") return "ended";
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return "upcoming";
  if (c.ends_at && new Date(c.ends_at).getTime() < now) return "ended";
  return "live";
}
export function trackOf(c: ExplorerContest): Track {
  if (c.contest_type === "coding") return "coding";
  const t = c.auto_scope?.track;
  return t === "school" || t === "college" || t === "exam" ? t : "other";
}
export type Filters = { status: Status | "all"; track: Track | "all"; subject: string; difficulty: "all" | "easy" | "medium" | "hard" };
export const NO_FILTERS: Filters = { status: "all", track: "all", subject: "", difficulty: "all" };

export function applyFilters(list: ExplorerContest[], f: Filters, now = Date.now()) {
  const q = f.subject.trim().toLowerCase();
  return list.filter((c) => {
    if (f.status !== "all" && statusOf(c, now) !== f.status) return false;
    if (f.track !== "all" && trackOf(c) !== f.track) return false;
    if (f.difficulty !== "all" && (c.auto_scope?.difficulty ?? "") !== f.difficulty) return false;
    if (q) {
      const hay = `${c.title} ${c.auto_scope?.subject ?? ""} ${c.auto_scope?.board ?? ""} ${c.auto_scope?.className ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
export function countdown(c: ExplorerContest, now = Date.now()): string {
  const s = statusOf(c, now);
  const target = s === "upcoming" ? c.starts_at : s === "live" ? c.ends_at : null;
  if (!target) return s === "ended" ? "Ended" : "Open";
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return s === "ended" ? "Ended" : "Starting";
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  const t = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  return s === "upcoming" ? `Starts in ${t}` : `Ends in ${t}`;
}
