import { z } from "zod";

export type SportsMatchState = "upcoming" | "live" | "completed" | "postponed" | "cancelled" | "abandoned" | "unknown";
export type SportsProviderId = "cricapi" | "sportmonks";
const scoreSchema = z.object({ r: z.number().nonnegative().optional(), w: z.number().nonnegative().optional(), o: z.number().nonnegative().optional(), inning: z.string().optional() });
const matchSchema = z.object({
  id: z.string().min(1), name: z.string().optional(), status: z.string().optional(),
  teams: z.array(z.string()).optional(), teamInfo: z.array(z.object({ name: z.string(), shortname: z.string().optional() })).optional(),
  score: z.array(scoreSchema).optional(), venue: z.string().optional(), matchType: z.string().optional(),
  dateTimeGMT: z.string().optional(), date: z.string().optional(), series: z.string().optional(), seriesName: z.string().optional(),
  matchStarted: z.boolean().optional(), matchEnded: z.boolean().optional(),
}).passthrough();

export function matchState(raw: Record<string, unknown>, status: string): SportsMatchState {
  if (/cancelled|canceled/i.test(status)) return "cancelled";
  if (/abandon|no result/i.test(status)) return "abandoned";
  if (/postpon|reschedul/i.test(status)) return "postponed";
  if (raw.matchEnded === true) return "completed";
  if (raw.matchStarted === true) return "live";
  if (raw.matchStarted === false && raw.matchEnded !== true) return "upcoming";
  return "unknown";
}

export function isStaleMatch(fetchedAt: string | null, refreshSeconds: number, now = Date.now()) {
  const fetched = fetchedAt ? Date.parse(fetchedAt) : NaN;
  return !Number.isFinite(fetched) || now - fetched > Math.max(120, refreshSeconds * 2) * 1000;
}

export function normalizeCricketMatch(input: unknown, fetchedAt: string) {
  const parsed = matchSchema.safeParse(input);
  if (!parsed.success) return null;
  const m = parsed.data;
  const teamA = m.teams?.[0] ?? m.teamInfo?.[0]?.name ?? "";
  const teamB = m.teams?.[1] ?? m.teamInfo?.[1]?.name ?? "";
  if (!teamA || !teamB) return null;
  const scoreFor = (team: string) => {
    const entry = m.score?.find(s => s.inning?.toLowerCase().includes(team.toLowerCase()));
    if (entry?.r === undefined) return "";
    return `${entry.r}${entry.w === undefined ? "" : `/${entry.w}`}${entry.o === undefined ? "" : ` (${entry.o} ov)`}`;
  };
  const date = m.dateTimeGMT ?? m.date;
  const utcDate = date && /^\d{4}-\d{2}-\d{2}T/.test(date) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(date) ? `${date}Z` : date;
  return {
    external_id: m.id, name: m.name || `${teamA} vs ${teamB}`, series: m.series ?? m.seriesName ?? null,
    status: m.status ?? "", venue: m.venue ?? "", date_time: utcDate && Number.isFinite(Date.parse(utcDate)) ? new Date(utcDate).toISOString() : null,
    team_a: teamA, team_b: teamB, score_a: scoreFor(teamA), score_b: scoreFor(teamB), match_type: m.matchType ?? "",
    is_live: matchState(m, m.status ?? "") === "live", squads: m.teamInfo ?? [],
    raw: JSON.parse(JSON.stringify(m)) as Record<string, unknown>, fetched_at: fetchedAt, updated_at: fetchedAt,
  };
}

const sportmonksSchema = z.object({
  id: z.union([z.string(), z.number()]), name: z.string().optional(), starting_at: z.string().optional(),
  venue: z.object({ name: z.string().optional() }).optional(), league: z.object({ name: z.string().optional() }).optional(),
  type: z.string().optional(), note: z.string().optional(),
  status: z.string(), live: z.boolean(),
  localteam: z.object({ id: z.number(), name: z.string().min(1) }),
  visitorteam: z.object({ id: z.number(), name: z.string().min(1) }),
  runs: z.array(z.object({ team_id: z.number(), score: z.number().nonnegative(), wickets: z.number().nonnegative().optional(), overs: z.number().nonnegative().optional(), inning: z.number().int().positive().optional() })).optional(),
}).passthrough();

/** Sportmonks Cricket API 2.0: localteam/visitorteam and runs include. */
export function normalizeSportmonksMatch(input: unknown, fetchedAt: string) {
  const parsed = sportmonksSchema.safeParse(input);
  if (!parsed.success) return null;
  const m = parsed.data;
  const teams = [m.localteam, m.visitorteam];
  const status = m.note ? `${m.status} — ${m.note}` : m.status;
  const ended = m.status === "Finished";
  const live = m.live && !ended && !/postp|aban|cancl/i.test(m.status);
  const scoreFor = (teamId: string | number) => {
    const innings = (m.runs ?? []).filter(run => String(run.team_id) === String(teamId)).sort((a, b) => (a.inning ?? 0) - (b.inning ?? 0));
    return innings.map(run => `${run.score}${run.wickets === undefined ? "" : `/${run.wickets}`}${run.overs === undefined ? "" : ` (${run.overs} ov)`}`).join(" & ");
  };
  const date = m.starting_at && /^\d{4}-\d{2}-\d{2} /.test(m.starting_at) ? `${m.starting_at.replace(" ", "T")}Z` : m.starting_at;
  const raw = { ...m, matchStarted: live || ended, matchEnded: ended, provider: "sportmonks" };
  return {
    external_id: `sportmonks:${m.id}`, name: m.name || `${teams[0].name} vs ${teams[1].name}`, series: m.league?.name ?? null,
    status, venue: m.venue?.name ?? "", date_time: date && Number.isFinite(Date.parse(date)) ? new Date(date).toISOString() : null,
    team_a: teams[0].name, team_b: teams[1].name, score_a: scoreFor(teams[0].id), score_b: scoreFor(teams[1].id), match_type: m.type ?? "",
    is_live: live, squads: teams, raw: JSON.parse(JSON.stringify(raw)) as Record<string, unknown>, fetched_at: fetchedAt, updated_at: fetchedAt,
  };
}