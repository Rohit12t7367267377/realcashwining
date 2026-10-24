import { blockMessage, type BlockReason } from "@/lib/monetization";

type ConsumeResult = { allowed: boolean; reason?: string; feature?: string; charged?: number; free?: number; paid?: number };

/**
 * The single server-side gate. Call it at the start of every metered handler, before any AI work.
 * Atomic in the database (limits + credits + usage + ledger). Throws a readable error ending in a machine code
 * when blocked. If the monetization SQL has not been applied yet, or the database is unreachable, it lets the
 * request through (fail-open) so existing features never break because of billing infrastructure.
 */
export async function enforceFeature(userId: string, feature: string, idempotencyKey?: string): Promise<ConsumeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).rpc("consume_feature", {
    _user: userId, _feature: feature, _idem: idempotencyKey ?? null,
  });
  if (error) {
    console.error("[monetization] consume_feature failed, allowing:", error.message);
    return { allowed: true };
  }
  const r = (data ?? { allowed: true }) as ConsumeResult;
  if (!r.allowed) {
    const reason = (r.reason as BlockReason) || "no_credits";
    let label: string | undefined;
    try {
      const { data: f } = await (supabaseAdmin as any).from("monetization_features").select("label").eq("feature_key", feature).maybeSingle();
      label = f?.label;
    } catch { /* label is cosmetic */ }
    throw new Error(blockMessage(reason, feature, label));
  }
  return r;
}
