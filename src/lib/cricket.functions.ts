import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Refreshes cricket_matches from the configured provider (CricAPI-compatible).
// Admin-only; call from /admin/cricket "Refresh now" button.
export const refreshCricketMatches = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key,value")
      .in("key", ["cricket_api_key", "cricket_api_provider", "cricket_enabled"]);
    const map = new Map((settings ?? []).map((r: any) => [r.key, r.value]));
    if (map.get("cricket_enabled") === false) throw new Error("Cricket API is disabled");
    const apiKey = String(map.get("cricket_api_key") ?? "").replace(/^"|"$/g, "");
    if (!apiKey) throw new Error("Set the Cricket API key first.");

    // CricAPI v1: currentMatches endpoint
    const url = `https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(apiKey)}&offset=0`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Cricket API HTTP ${res.status}`);
    const json = await res.json() as any;
    if (json.status && json.status !== "success") throw new Error(json.reason || "Cricket API error");
    const matches = Array.isArray(json.data) ? json.data : [];

    let upserted = 0;
    for (const m of matches) {
      const teamA = m.teams?.[0] ?? m.teamInfo?.[0]?.name ?? "";
      const teamB = m.teams?.[1] ?? m.teamInfo?.[1]?.name ?? "";
      const scoreA = m.score?.find((s: any) => (s.inning || "").includes(teamA))?.r != null
        ? `${m.score.find((s: any) => (s.inning || "").includes(teamA)).r}/${m.score.find((s: any) => (s.inning || "").includes(teamA)).w} (${m.score.find((s: any) => (s.inning || "").includes(teamA)).o})`
        : "";
      const scoreB = m.score?.find((s: any) => (s.inning || "").includes(teamB))?.r != null
        ? `${m.score.find((s: any) => (s.inning || "").includes(teamB)).r}/${m.score.find((s: any) => (s.inning || "").includes(teamB)).w} (${m.score.find((s: any) => (s.inning || "").includes(teamB)).o})`
        : "";
      const row = {
        external_id: m.id,
        name: m.name || `${teamA} vs ${teamB}`,
        status: m.status || "",
        venue: m.venue || "",
        date_time: m.dateTimeGMT || m.date || null,
        team_a: teamA,
        team_b: teamB,
        score_a: scoreA,
        score_b: scoreB,
        match_type: m.matchType || "",
        is_live: !m.matchEnded && !!m.matchStarted,
        raw: m,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin.from("cricket_matches").upsert(row, { onConflict: "external_id" });
      if (!error) upserted++;
    }
    return { upserted, total: matches.length };
  });
