// Admin overview for contests: dashboard numbers, participants, results, anti-cheat review flags and audit trail.
// Read-only except for the audit note; prizes, ranks and scores are only changed by the existing result flow.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reviewFlags } from "@/lib/contest-review";

const admin = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function writeContestAudit(actorId: string, action: string, targetType: string, targetId: string | null, after: Record<string, unknown> = {}, reason: string | null = null) {
  try {
    await admin.from("admin_audit_logs").insert({
      actor_id: actorId, permission_key: "contests.manage", action, target_type: targetType, target_id: targetId,
      result: "success", reason, after_data: after, metadata: {},
    });
  } catch { /* audit must never block the admin action */ }
}

export const adminContestOverview = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ contestId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: contest } = await admin.from("contests").select("id, title, num_questions, duration_minutes, starts_at, ends_at, active, contest_type, results_status, marks_correct, marks_wrong, auto_scope, review_required").eq("id", data.contestId).maybeSingle();
    if (!contest) throw new Error("Contest not found");
    const { data: attempts } = await admin.from("contest_attempts")
      .select("id, user_id, started_at, submitted_at, score, rank, violations, device_fingerprint, ip_address, answers, status, is_winner")
      .eq("contest_id", data.contestId).limit(5000);
    const rows = (attempts ?? []) as any[];
    const submitted = rows.filter((r) => r.submitted_at);
    const scores = submitted.map((r) => Number(r.score ?? 0));
    const flags = reviewFlags(rows.map((r) => ({
      id: r.id, userId: r.user_id, startedAt: r.started_at, submittedAt: r.submitted_at, violations: r.violations ?? 0,
      fingerprint: r.device_fingerprint, ip: r.ip_address, answers: r.answers,
    })), { numQuestions: contest.num_questions });
    const ids = [...new Set(rows.map((r) => r.user_id))].slice(0, 500);
    const { data: profiles } = ids.length ? await admin.from("profiles").select("id, username, full_name").in("id", ids) : { data: [] };
    const nm = new Map<string, string>((profiles ?? []).map((p: any) => [p.id, p.username || p.full_name || p.id.slice(0, 8)]));
    const top = [...submitted].sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0)).slice(0, 20)
      .map((r) => ({ attemptId: r.id, name: nm.get(r.user_id) ?? "Player", score: Number(r.score ?? 0), rank: r.rank, violations: r.violations ?? 0 }));
    const { data: audit } = await admin.from("admin_audit_logs").select("id, actor_id, action, target_type, target_id, reason, created_at, after_data")
      .or(`target_id.eq.${data.contestId},after_data->>contest_id.eq.${data.contestId}`).order("created_at", { ascending: false }).limit(50);
    return {
      contest,
      stats: {
        participants: rows.length, submitted: submitted.length,
        completionRate: rows.length ? Math.round((submitted.length / rows.length) * 100) : 0,
        avgScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0,
        maxScore: scores.length ? Math.max(...scores) : 0,
        flagged: new Set(flags.map((f) => f.attemptId)).size,
      },
      top,
      flags: flags.map((f) => ({ ...f, name: nm.get(f.userId) ?? "Player" })),
      audit: audit ?? [],
    };
  });

export const adminContestNote = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ contestId: z.string().uuid(), attemptId: z.string().uuid().optional(), note: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await writeContestAudit(context.adminUserId, "contest.review_note", "contest", data.contestId, { contest_id: data.contestId, attempt_id: data.attemptId ?? null }, data.note);
    return { ok: true };
  });
