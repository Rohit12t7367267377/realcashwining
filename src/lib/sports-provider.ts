import { z } from "zod";

export type SportsMatchState = "upcoming" | "live" | "completed" | "postponed" | "cancelled" | "abandoned" | "unknown";
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