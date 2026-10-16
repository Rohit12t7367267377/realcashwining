// Turns a stored provider row (cricket_matches) into the engine's verified
// MatchRef / MatchFacts. Pure: no database, no network, easy to test.
// Nothing here guesses: anything the provider did not state stays unknown.
import { isStaleMatch, matchState } from "../sports-provider";
import { maxOvers, normalizeFormat } from "./generate";
import type { InningsFacts, MatchFacts, MatchRef } from "./types";

export interface MatchRow {
  id: string;
  name: string | null;
  status: string | null;
  date_time: string | null;
  team_a: string | null;
  team_b: string | null;
  match_type: string | null;
  is_live: boolean | null;
  raw: Record<string, unknown> | null;
  fetched_at: string | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

export function rowToRef(row: MatchRow): MatchRef {
  const status = row.status ?? "";
  return {
    id: row.id,
    sport: "cricket",
    format: normalizeFormat(row.match_type ?? ""),
    startsAt: row.date_time,
    state: matchState(row.raw ?? {}, status),
    teamA: row.team_a ?? "",
    teamB: row.team_b ?? "",
    statusText: status,
  };
}

const sameTeam = (a: string, b: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** CricAPI: raw.score = [{ r, w, o, inning: "India Inning 1" }], listed in batting order. */
function cricapiInnings(raw: Record<string, unknown>): Array<{ team: string; runs: number; wickets: number; overs: number }> {
  const list = Array.isArray(raw.score) ? raw.score : [];
  const out: Array<{ team: string; runs: number; wickets: number; overs: number }> = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const runs = num(s.r);
    if (runs === null) continue;
    out.push({
      team: str(s.inning).replace(/\s+inning[s]?\s*\d*\s*$/i, "").trim(),
      runs,
      wickets: num(s.w) ?? 0,
      overs: num(s.o) ?? 0,
    });
  }
  return out;
}

/** Sportmonks: raw.runs = [{ team_id, score, wickets, overs, inning }] + localteam/visitorteam. */
function sportmonksInnings(raw: Record<string, unknown>): Array<{ team: string; runs: number; wickets: number; overs: number }> {
  const runs = Array.isArray(raw.runs) ? raw.runs : [];
  const teams = new Map<string, string>();
  for (const key of ["localteam", "visitorteam"]) {
    const t = raw[key] as Record<string, unknown> | undefined;
    if (t && t.id !== undefined) teams.set(String(t.id), str(t.name));
  }
  return runs
    .map((r) => r as Record<string, unknown>)
    .filter((r) => num(r.score) !== null)
    .sort((a, b) => (num(a.inning) ?? 0) - (num(b.inning) ?? 0))
    .map((r) => ({
      team: teams.get(String(r.team_id)) ?? "",
      runs: num(r.score) as number,
      wickets: num(r.wickets) ?? 0,
      overs: num(r.overs) ?? 0,
    }));
}

/** "India won by 5 runs" -> A/B; "Match tied" -> tie; anything else -> null (not decided). */
export function winnerFromStatus(status: string, teamA: string, teamB: string): MatchFacts["winner"] {
  const s = status.trim();
  if (!s) return null;
  if (/\b(no result|abandon|cancel|postpon)/i.test(s)) return null;
  if (/\btie[d]?\b/i.test(s) && !/\bwon by\b/i.test(s)) return "tie";
  const m = /^(.*?)\s+won\b/i.exec(s);
  if (!m) return null;
  const winner = m[1].trim();
  const a = sameTeam(winner, teamA);
  const b = sameTeam(winner, teamB);
  if (a && !b) return "A";
  if (b && !a) return "B";
  // Allow "India Women won" style when only one side contains the name.
  const lc = winner.toLowerCase();
  const inA = teamA && (lc.includes(teamA.toLowerCase()) || teamA.toLowerCase().includes(lc));
  const inB = teamB && (lc.includes(teamB.toLowerCase()) || teamB.toLowerCase().includes(lc));
  if (inA && !inB) return "A";
  if (inB && !inA) return "B";
  return null;
}

/**
 * Verified facts for a match, or null when the data cannot be trusted:
 * a live match whose last provider refresh is stale yields null so that no
 * contest is generated or settled from out-of-date numbers.
 */
export function rowToFacts(row: MatchRow, opts: { nowMs: number; refreshSeconds: number }): MatchFacts | null {
  const ref = rowToRef(row);
  if (ref.state === "unknown") return null;
  if (ref.state === "live" && isStaleMatch(row.fetched_at, opts.refreshSeconds, opts.nowMs)) return null;

  const raw = row.raw ?? {};
  const provider = str(raw.provider);
  const parsed = provider === "sportmonks" ? sportmonksInnings(raw) : cricapiInnings(raw);
  const completed = ref.state === "completed";
  const maxO = maxOvers(ref.format);

  const innings: InningsFacts[] = parsed.map((p, idx) => {
    const isLast = idx === parsed.length - 1;
    // An innings is "complete" only when that is certain: a later innings has begun,
    // the match is over, ten wickets fell, or the format's over limit was reached.
    const complete = !isLast || completed || p.wickets >= 10 || (maxO !== null && p.overs >= maxO);
    return { no: idx + 1, team: p.team, runs: p.runs, wickets: p.wickets, overs: p.overs, complete };
  });

  return {
    matchId: row.id,
    state: ref.state,
    statusText: ref.statusText,
    teamA: ref.teamA,
    teamB: ref.teamB,
    winner: completed ? winnerFromStatus(ref.statusText, ref.teamA, ref.teamB) : null,
    innings,
    verifiedAt: row.fetched_at ?? new Date(opts.nowMs).toISOString(),
  };
}
