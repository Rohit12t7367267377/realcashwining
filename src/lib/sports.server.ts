// Server-only helpers for the Sports category automation layer.
// Everything here is additive: it never touches non-sports contests.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAiChat, extractJson } from "@/lib/ai-gateway.server";

export type SportsConfig = {
  enabled: boolean;
  hasKey: boolean;
  apiKey: string;
  provider: string;
  refreshSeconds: number;
  autoQuiz: boolean;
  autoResult: boolean;
  autoReading: boolean;
  questionsPerMatch: number;
  requireReview: boolean;
};

const KEYS = [
  "cricket_enabled",
  "cricket_api_key",
  "cricket_api_provider",
  "cricket_refresh_seconds",
  "sports_auto_quiz",
  "sports_auto_result",
  "sports_auto_reading",
  "sports_questions_per_match",
  "sports_require_review",
] as const;

const asBool = (v: unknown, d: boolean) =>
  v === true || v === "true" ? true : v === false || v === "false" ? false : d;
const asStr = (v: unknown, d = "") =>
  typeof v === "string" ? v.replace(/^"|"$/g, "") : v == null ? d : String(v);
const asNum = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * Admins often paste the whole sample URL or the key with extra query params
 * (e.g. "abc-123&offset=0"). Keep only the credential itself.
 */
export function sanitizeApiKey(raw: string) {
  let k = raw.trim().replace(/^["']|["']$/g, "");
  const m = k.match(/apikey=([^&\s]+)/i);
  if (m) k = m[1];
  k = k.split(/[?&\s]/)[0];
  return k.trim();
}


export async function readSportsConfig(): Promise<SportsConfig> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("key, value")
    .in("key", KEYS as unknown as string[]);
  const m = new Map<string, unknown>((data ?? []).map((r) => [r.key, r.value]));
  const apiKey = asStr(m.get("cricket_api_key"));
  return {
    enabled: asBool(m.get("cricket_enabled"), true),
    hasKey: apiKey.length > 0,
    apiKey,
    provider: asStr(m.get("cricket_api_provider"), "cricapi") || "cricapi",
    refreshSeconds: Math.max(30, asNum(m.get("cricket_refresh_seconds"), 60)),
    autoQuiz: asBool(m.get("sports_auto_quiz"), false),
    autoResult: asBool(m.get("sports_auto_result"), true),
    autoReading: asBool(m.get("sports_auto_reading"), false),
    questionsPerMatch: Math.min(25, Math.max(1, asNum(m.get("sports_questions_per_match"), 5))),
    requireReview: asBool(m.get("sports_require_review"), true),
  };
}

type ScoreEntry = { r?: number; w?: number; o?: number; inning?: string };

function formatScore(score: ScoreEntry[] | undefined, team: string) {
  const e = (score ?? []).find((s) => (s.inning ?? "").toLowerCase().includes(team.toLowerCase()));
  if (!e || e.r == null) return "";
  return `${e.r}/${e.w ?? 0} (${e.o ?? 0} ov)`;
}

/** Pull the live match list from the provider and upsert verified facts. */
export async function refreshSportsMatches() {
  const cfg = await readSportsConfig();
  if (!cfg.enabled) throw new Error("Sports live data is disabled.");
  if (!cfg.hasKey) throw new Error("Add the live sports API key first.");

  const url = `https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(cfg.apiKey)}&offset=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Live sports API returned HTTP ${res.status}`);
  const json = (await res.json()) as { status?: string; reason?: string; data?: unknown[] };
  if (json.status && json.status !== "success") throw new Error(json.reason || "Live sports API error");
  const matches = Array.isArray(json.data) ? (json.data as Record<string, any>[]) : [];

  let upserted = 0;
  for (const m of matches) {
    const teamA = m.teams?.[0] ?? m.teamInfo?.[0]?.name ?? "";
    const teamB = m.teams?.[1] ?? m.teamInfo?.[1]?.name ?? "";
    const row = {
      external_id: String(m.id ?? ""),
      name: m.name || `${teamA} vs ${teamB}`,
      series: m.series ?? m.seriesName ?? null,
      status: m.status || "",
      venue: m.venue || "",
      date_time: m.dateTimeGMT || m.date || null,
      team_a: teamA,
      team_b: teamB,
      score_a: formatScore(m.score, teamA),
      score_b: formatScore(m.score, teamB),
      match_type: m.matchType || "",
      is_live: !m.matchEnded && !!m.matchStarted,
      squads: Array.isArray(m.teamInfo) ? m.teamInfo : [],
      raw: m,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (!row.external_id) continue;
    const { error } = await supabaseAdmin
      .from("cricket_matches")
      .upsert(row, { onConflict: "external_id" });
    if (!error) upserted++;
  }
  return { total: matches.length, upserted };
}

export type MatchFacts = {
  id: string;
  name: string;
  series: string | null;
  status: string;
  venue: string | null;
  matchType: string | null;
  teamA: string | null;
  teamB: string | null;
  scoreA: string | null;
  scoreB: string | null;
  isLive: boolean;
  ended: boolean;
  dateTime: string | null;
};

export async function readMatchFacts(matchId: string): Promise<MatchFacts> {
  const { data, error } = await supabaseAdmin
    .from("cricket_matches")
    .select("*")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Match not found");
  const raw = (data.raw ?? {}) as Record<string, unknown>;
  return {
    id: data.id,
    name: data.name,
    series: (data as { series?: string | null }).series ?? null,
    status: data.status ?? "",
    venue: data.venue,
    matchType: data.match_type,
    teamA: data.team_a,
    teamB: data.team_b,
    scoreA: data.score_a,
    scoreB: data.score_b,
    isLive: !!data.is_live,
    ended: raw["matchEnded"] === true,
    dateTime: data.date_time,
  };
}

function factsBlock(f: MatchFacts) {
  return [
    `Match: ${f.name}`,
    f.series ? `Series: ${f.series}` : null,
    f.matchType ? `Format: ${f.matchType}` : null,
    f.venue ? `Venue: ${f.venue}` : null,
    f.dateTime ? `Scheduled (UTC): ${f.dateTime}` : null,
    f.teamA ? `Team A: ${f.teamA}${f.scoreA ? ` — ${f.scoreA}` : ""}` : null,
    f.teamB ? `Team B: ${f.teamB}${f.scoreB ? ` — ${f.scoreB}` : ""}` : null,
    `Official status: ${f.status || "unknown"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Drafts multiple-choice questions strictly from stored, provider-verified
 * match facts. Drafts always land in review — nothing goes live by itself.
 */
export async function generateMatchQuestionDrafts(opts: {
  matchId: string;
  count: number;
  contestId?: string | null;
  categoryId?: string | null;
  difficulty?: string;
}) {
  const facts = await readMatchFacts(opts.matchId);
  const prompt = `You write cricket quiz questions using ONLY the verified facts below. Never invent statistics, players, scores or outcomes that are not derivable from these facts. If a fact is unknown, do not ask about it.

VERIFIED FACTS
${factsBlock(facts)}

Write ${opts.count} multiple-choice questions about this match (teams, venue, format, series, current situation and the officially reported status). Difficulty: ${opts.difficulty ?? "mixed"}.
Return STRICT minified JSON only:
{"questions":[{"question":"...","options":["A","B","C","D"],"correct_index":0,"explanation":"one short sentence citing the fact used"}]}
Rules: exactly 4 options, correct_index 0..3, question under 200 chars, options under 80 chars, each answer must be verifiable from the facts above.`;

  const raw = await callAiChat(
    [
      { role: "system", content: "You output only valid minified JSON. No prose, no code fences." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.5, responseFormat: "json_object" },
  );

  const parsed = extractJson(raw) as {
    questions?: Array<{ question?: string; options?: string[]; correct_index?: number; explanation?: string }>;
  };
  const items = (parsed.questions ?? [])
    .filter(
      (q) =>
        typeof q.question === "string" &&
        q.question.trim().length > 4 &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.every((o) => typeof o === "string" && o.trim().length > 0) &&
        Number.isInteger(q.correct_index) &&
        (q.correct_index as number) >= 0 &&
        (q.correct_index as number) < 4,
    )
    .map((q) => ({
      match_id: opts.matchId,
      contest_id: opts.contestId ?? null,
      category_id: opts.categoryId ?? null,
      question: q.question!.trim().slice(0, 500),
      options: q.options!.map((o) => o.trim().slice(0, 200)),
      correct_index: q.correct_index as number,
      explanation: (q.explanation ?? "").toString().slice(0, 500) || null,
      difficulty: opts.difficulty ?? "medium",
      source: "ai",
      status: "pending",
    }));

  if (!items.length) throw new Error("No verifiable questions could be drafted from the current match data.");

  const { error } = await supabaseAdmin.from("sports_quiz_drafts").insert(items);
  if (error) throw new Error(error.message);
  return { drafted: items.length };
}

/** Drafts a reading-comprehension passage + questions from verified match facts. */
export async function generateMatchReadingPassage(opts: {
  matchId: string;
  categoryId: string | null;
  numQuestions: number;
}) {
  const facts = await readMatchFacts(opts.matchId);
  const prompt = `Using ONLY the verified facts below, write a factual reading-comprehension passage (140-220 words) about this cricket match, then ${opts.numQuestions} multiple-choice questions answerable purely from your passage.

VERIFIED FACTS
${factsBlock(facts)}

Return STRICT minified JSON only:
{"title":"...","passage":"...","questions":[{"question":"...","options":["A","B","C","D"],"correct_index":0,"explanation":"..."}]}
Do not invent players, scores or results that are not in the facts.`;

  const raw = await callAiChat(
    [
      { role: "system", content: "You output only valid minified JSON. No prose, no code fences." },
      { role: "user", content: prompt },
    ],
    { temperature: 0.5, responseFormat: "json_object" },
  );
  const parsed = extractJson(raw) as {
    title?: string;
    passage?: string;
    questions?: Array<{ question?: string; options?: string[]; correct_index?: number; explanation?: string }>;
  };
  const title = (parsed.title ?? facts.name).toString().slice(0, 200);
  const passage = (parsed.passage ?? "").toString().trim();
  const qs = (parsed.questions ?? []).filter(
    (q) =>
      typeof q.question === "string" &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      Number.isInteger(q.correct_index),
  );
  if (!passage || !qs.length) throw new Error("AI could not draft a valid passage. Try again.");

  const { data: row, error } = await supabaseAdmin
    .from("reading_passages")
    .insert({
      title,
      passage: passage.slice(0, 20000),
      category_id: opts.categoryId,
      match_id: opts.matchId,
      num_questions: qs.length,
      reading_seconds: 90,
      quiz_seconds: Math.max(60, qs.length * 45),
      difficulty: "medium",
      active: false,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: qErr } = await supabaseAdmin.from("reading_questions").insert(
    qs.map((q, i) => ({
      passage_id: row.id,
      question: q.question!.trim().slice(0, 2000),
      options: q.options!.map((o) => String(o).trim().slice(0, 500)),
      correct_index: Math.min(3, Math.max(0, q.correct_index as number)),
      explanation: (q.explanation ?? "").toString().slice(0, 2000) || null,
      sort_order: i,
    })),
  );
  if (qErr) throw new Error(qErr.message);
  return { passage_id: row.id, questions: qs.length, active: false };
}

/**
 * Automatic sports pass: drafts questions for live match-linked contests and
 * finalises sports contests only once the provider confirms the match ended.
 */
export async function runSportsAutomation() {
  const cfg = await readSportsConfig();
  const out = { enabled: cfg.enabled, drafted: 0, finalized: [] as string[], waiting: [] as string[] };
  if (!cfg.enabled) return out;

  const { data: linked } = await supabaseAdmin
    .from("contests")
    .select("id, title, match_id, auto_quiz, auto_result, category_id, results_status, ends_at")
    .not("match_id", "is", null)
    .limit(50);

  for (const c of linked ?? []) {
    const matchId = c.match_id as string;
    if (cfg.autoQuiz && c.auto_quiz) {
      const { count } = await supabaseAdmin
        .from("sports_quiz_drafts")
        .select("id", { count: "exact", head: true })
        .eq("match_id", matchId)
        .eq("status", "pending");
      if (!count) {
        try {
          const r = await generateMatchQuestionDrafts({
            matchId,
            count: cfg.questionsPerMatch,
            contestId: c.id,
            categoryId: c.category_id,
          });
          out.drafted += r.drafted;
        } catch {
          // never block the batch on one AI failure
        }
      }
    }

    if (cfg.autoResult && c.auto_result && c.results_status === "pending") {
      let ended = false;
      try {
        const facts = await readMatchFacts(matchId);
        ended = facts.ended || (!facts.isLive && /won|draw|tie|abandon|no result/i.test(facts.status));
      } catch {
        ended = false;
      }
      const timeUp = c.ends_at ? Date.parse(c.ends_at) < Date.now() : false;
      if (ended && timeUp) {
        try {
          const { finalizeContest } = await import("@/lib/automation.server");
          await finalizeContest(c.id);
          out.finalized.push(c.id);
        } catch {
          out.waiting.push(c.id);
        }
      } else {
        out.waiting.push(c.id);
      }
    }
  }
  return out;
}
