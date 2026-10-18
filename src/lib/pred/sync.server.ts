// Background orchestration for the prediction engine. Safe to call repeatedly
// (cron, manual "run now"): every step is idempotent and failures are recorded,
// never thrown into the caller.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeBalls } from "./ball-feed";
import { emptyReport, runTick, type TickReport } from "./engine";
import { SupabasePredStore } from "./supabase-store.server";

const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
const OVERLAP_MS = 5 * 60_000;
const MAX_BBB_MATCHES_PER_TICK = 4; // protects provider quota

async function setting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value ?? fallback) as T;
}

/** Fixed provider origin; the key never follows a redirect or a caller-chosen host. */
export async function fetchBallPayload(externalId: string, apiKey: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  const url = new URL("https://api.cricapi.com/v1/match_bbb");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("id", externalId);
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try { res = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(10_000) }); }
    catch { if (attempt < 2) continue; throw new Error("Ball-by-ball provider could not be reached."); }
    if (res.status === 429) throw new Error("Ball-by-ball provider quota exceeded.");
    if (res.status >= 500 && attempt < 2) { await res.body?.cancel(); continue; }
    if (!res.ok) throw new Error(`Ball-by-ball request failed (HTTP ${res.status}).`);
    return res.json();
  }
  throw new Error("Ball-by-ball provider is temporarily unavailable.");
}

/** Idempotent upsert. A changed delivery bumps `revision`, which the engine treats as a correction. */
export async function ingestBallEvents(
  matchId: string,
  events: Array<{ eventKey: string; innings: number; over: number; seq: number; legal: boolean; runsBat: number; extras: number; wicket: boolean; extraType?: string | null }>,
): Promise<{ inserted: number; revised: number }> {
  if (!events.length) return { inserted: 0, revised: 0 };
  const { data: existing, error } = await db
    .from("pred_events")
    .select("id, event_key, innings, over, seq, legal, runs_bat, extras, wicket, revision, extra_type")
    .eq("match_id", matchId)
    .limit(5000);
  if (error) throw new Error(`Could not read existing events: ${error.message}`);
  const prev = new Map<string, any>((existing as any[]).map((e) => [e.event_key, e]));
  let inserted = 0, revised = 0;
  const fresh: any[] = [];
  for (const e of events) {
    const p = prev.get(e.eventKey);
    const row = { match_id: matchId, event_key: e.eventKey, innings: e.innings, over: e.over, seq: e.seq, legal: e.legal, runs_bat: e.runsBat, extras: e.extras, wicket: e.wicket, extra_type: e.extraType ?? null };
    if (!p) { fresh.push({ ...row, revision: 1 }); continue; }
    const same = p.innings === e.innings && p.over === e.over && p.seq === e.seq && p.legal === e.legal
      && p.runs_bat === e.runsBat && p.extras === e.extras && p.wicket === e.wicket && (p.extra_type ?? null) === (e.extraType ?? null);
    if (same) continue;
    const { error: ue } = await db.from("pred_events").update({ ...row, revision: p.revision + 1, received_at: new Date().toISOString() }).eq("id", p.id).eq("revision", p.revision);
    if (ue) throw new Error(`Could not revise event: ${ue.message}`);
    revised++;
  }
  if (fresh.length) {
    const { error: ie } = await db.from("pred_events").upsert(fresh, { onConflict: "match_id,event_key", ignoreDuplicates: true });
    if (ie) throw new Error(`Could not store events: ${ie.message}`);
    inserted = fresh.length;
  }
  return { inserted, revised };
}

async function syncBallEvents(report: TickReport) {
  if (!(await setting<boolean>("pred_bbb_enabled", false))) return;
  const { readSportsConfig } = await import("@/lib/sports.server");
  const cfg = await readSportsConfig();
  if (!cfg.apiKey) { report.errors.push("ball-by-ball: provider key is not configured"); return; }
  const { data: live, error } = await db
    .from("cricket_matches").select("id, external_id").eq("is_live", true).not("external_id", "like", "sportmonks:%").limit(MAX_BBB_MATCHES_PER_TICK);
  if (error) { report.errors.push(`ball-by-ball: ${error.message}`); return; }
  for (const m of live as Array<{ id: string; external_id: string }>) {
    try {
      const parsed = normalizeBalls(await fetchBallPayload(m.external_id, cfg.apiKey));
      if (parsed.total > 0 && parsed.events.length === 0) {
        report.errors.push(`ball-by-ball ${m.external_id}: provider returned ${parsed.total} rows but none were recognised. Verify the feed format before enabling over-by-over contests.`);
        continue;
      }
      await ingestBallEvents(m.id, parsed.events);
    } catch (e) {
      report.errors.push(`ball-by-ball ${m.external_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

export interface PredTickResult { skipped?: string; report?: TickReport; jobId?: string }

/** One full automation pass: fixtures -> events -> generation -> lifecycle -> settlement. */
export async function runPredTick(opts: { trigger: "cron" | "manual"; refreshFixtures?: boolean } = { trigger: "cron" }): Promise<PredTickResult> {
  if (!(await setting<boolean>("pred_engine_enabled", true))) return { skipped: "engine_disabled" };

  const since = new Date(Date.now() - OVERLAP_MS).toISOString();
  const { data: running } = await db.from("pred_jobs").select("id").eq("job", "tick").eq("status", "running").gte("started_at", since).limit(1);
  if (running?.length) return { skipped: "already_running" };

  const { data: job, error: je } = await db.from("pred_jobs").insert({ job: "tick", status: "running" }).select("id").single();
  if (je) throw new Error(`Could not start job: ${je.message}`);
  const report = emptyReport();
  try {
    let refreshSeconds = 60;
    try {
      const { readSportsConfig, refreshSportsMatches } = await import("@/lib/sports.server");
      const cfg = await readSportsConfig();
      refreshSeconds = cfg.refreshSeconds;
      if (opts.refreshFixtures !== false && cfg.enabled && cfg.hasKey) await refreshSportsMatches();
    } catch (e) {
      // Provider trouble must not stop settlement of already-verified data; stale live data is rejected by the store.
      report.errors.push(`fixtures: ${e instanceof Error ? e.message : String(e)}`);
    }
    await syncBallEvents(report);
    const tick = await runTick(new SupabasePredStore({ refreshSeconds }), Date.now());
    report.generated += tick.generated; report.published += tick.published; report.locked += tick.locked;
    report.cancelled += tick.cancelled; report.voided += tick.voided; report.refunded += tick.refunded; report.resolved += tick.resolved; report.completed += tick.completed;
    report.corrections += tick.corrections; report.credited += tick.credited; report.notices += tick.notices;
    report.errors.push(...tick.errors);
    for (const [k, v] of Object.entries(tick.skipped)) report.skipped[k] = (report.skipped[k] ?? 0) + v;

    const status = report.errors.length && !report.generated && !report.completed && !report.resolved && !report.locked && !report.published ? "failed" : "ok";
    await db.from("pred_jobs").update({ status, finished_at: new Date().toISOString(), result: report, error: report.errors.slice(0, 5).join(" | ") || null }).eq("id", job.id);
    return { report, jobId: job.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("pred_jobs").update({ status: "failed", finished_at: new Date().toISOString(), error: message, result: report }).eq("id", job.id);
    throw e;
  }
}
