// Server-only campaign dispatcher: resolves the audience, records deliveries,
// and sends push messages through FCM when credentials are configured.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendToToken, isDeadTokenError, getFcmCredentials } from "./push.server";

type Campaign = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  deep_link: string | null;
  data: Record<string, unknown> | null;
  audience: string;
  target_user_ids: string[] | null;
  category_id: string | null;
  contest_id: string | null;
};

export async function resolveAudience(c: Campaign): Promise<string[]> {
  const admin = supabaseAdmin as any;

  if (c.audience === "selected") {
    return Array.from(new Set(c.target_user_ids ?? []));
  }

  if (c.audience === "premium") {
    const { data } = await admin
      .from("user_memberships")
      .select("user_id")
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString());
    return Array.from(new Set((data ?? []).map((r: any) => r.user_id as string)));
  }

  if (c.audience === "contest" && c.contest_id) {
    const { data } = await admin.from("contest_attempts").select("user_id").eq("contest_id", c.contest_id);
    return Array.from(new Set((data ?? []).map((r: any) => r.user_id as string)));
  }

  if (c.audience === "category" && c.category_id) {
    const { data: contests } = await admin.from("contests").select("id").eq("category_id", c.category_id);
    const ids = (contests ?? []).map((r: any) => r.id as string);
    if (!ids.length) return [];
    const { data } = await admin.from("contest_attempts").select("user_id").in("contest_id", ids);
    return Array.from(new Set((data ?? []).map((r: any) => r.user_id as string)));
  }

  // all
  const { data } = await admin.from("profiles").select("id").eq("banned", false);
  return (data ?? []).map((r: any) => r.id as string);
}

export async function dispatchCampaign(campaignId: string) {
  const admin = supabaseAdmin as any;
  const { data: campaign, error } = await admin
    .from("push_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!campaign) throw new Error("Campaign not found");

  await admin.from("push_campaigns").update({ status: "sending" }).eq("id", campaignId);

  const userIds = await resolveAudience(campaign as Campaign);
  const configured = Boolean(getFcmCredentials());

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  // Clear previous delivery rows so a resend reports fresh status.
  await admin.from("push_deliveries").delete().eq("campaign_id", campaignId);

  if (userIds.length) {
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("user_id,token")
      .eq("enabled", true)
      .in("user_id", userIds.slice(0, 20000));
    const byUser = new Map<string, string[]>();
    for (const t of tokens ?? []) {
      const list = byUser.get(t.user_id) ?? [];
      list.push(t.token);
      byUser.set(t.user_id, list);
    }

    const rows: any[] = [];
    for (const userId of userIds) {
      const list = byUser.get(userId) ?? [];
      if (!list.length) {
        rows.push({ campaign_id: campaignId, user_id: userId, status: "in_app_only" });
        continue;
      }
      for (const token of list) {
        if (!configured) {
          rows.push({ campaign_id: campaignId, user_id: userId, token, status: "pending", error: "FCM not configured" });
          continue;
        }
        const err = await sendToToken(token, {
          title: campaign.title,
          body: campaign.body,
          imageUrl: campaign.image_url,
          link: campaign.deep_link,
          data: Object.fromEntries(
            Object.entries(campaign.data ?? {}).map(([k, v]) => [k, String(v)]),
          ),
        });
        if (err) {
          failed++;
          lastError = err;
          if (isDeadTokenError(err)) {
            await admin.from("push_tokens").update({ enabled: false }).eq("token", token);
          }
          rows.push({ campaign_id: campaignId, user_id: userId, token, status: "failed", error: err.slice(0, 300) });
        } else {
          sent++;
          rows.push({ campaign_id: campaignId, user_id: userId, token, status: "sent" });
        }
      }
    }

    for (let i = 0; i < rows.length; i += 500) {
      await admin.from("push_deliveries").insert(rows.slice(i, i + 500));
    }
  }

  await admin
    .from("push_campaigns")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      recipients_count: userIds.length,
      sent_count: sent,
      failed_count: failed,
      last_error: lastError,
    })
    .eq("id", campaignId);

  return { recipients: userIds.length, sent, failed, pushConfigured: configured };
}

/** Sends queued campaigns and any scheduled campaign whose time has arrived. */
export async function dispatchDueCampaigns(limit = 20) {
  const admin = supabaseAdmin as any;
  const { data } = await admin
    .from("push_campaigns")
    .select("id")
    .in("status", ["queued", "scheduled"])
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  const results: { id: string; sent: number; failed: number }[] = [];
  for (const row of data ?? []) {
    try {
      const r = await dispatchCampaign(row.id);
      results.push({ id: row.id, sent: r.sent, failed: r.failed });
    } catch (e) {
      await admin
        .from("push_campaigns")
        .update({ status: "failed", last_error: e instanceof Error ? e.message : String(e) })
        .eq("id", row.id);
    }
  }
  return { processed: results.length, results };
}
