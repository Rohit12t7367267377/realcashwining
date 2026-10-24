// Client-safe helpers for the admin-controlled credit system (no server imports).
export type BlockReason = "no_credits" | "limit_daily" | "limit_monthly" | "feature_disabled";
export type BlockInfo = { reason: BlockReason; feature: string };

const CODE_RE = /\(code: (no_credits|limit_daily|limit_monthly|feature_disabled) · ([a-z_]+)\)/;

export function blockMessage(reason: BlockReason, feature: string, label?: string): string {
  const name = label || feature;
  const text: Record<BlockReason, string> = {
    no_credits: `You have no credits left for ${name}.`,
    limit_daily: `You reached today's limit for ${name}.`,
    limit_monthly: `You reached this month's limit for ${name}.`,
    feature_disabled: `${name} is currently turned off.`,
  };
  return `${text[reason]} (code: ${reason} · ${feature})`;
}

/** Reads the machine code the server puts at the end of a blocked-feature error. */
export function parseBlock(err: unknown): BlockInfo | null {
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const m = CODE_RE.exec(msg);
  return m ? { reason: m[1] as BlockReason, feature: m[2] } : null;
}

export const BLOCK_EVENT = "monetization:blocked";

export type UpgradeSettings = {
  title: string; message: string; cta_label: string; cta_url: string; show_plans: boolean; show_offers: boolean;
};
export type MonetizationSettings = {
  enabled: boolean; signup_credits: number; signup_credit_expiry_days: number; monthly_free_credits: number; upgrade: UpgradeSettings;
};
export const DEFAULT_SETTINGS: MonetizationSettings = {
  enabled: false, signup_credits: 30, signup_credit_expiry_days: 0, monthly_free_credits: 0,
  upgrade: {
    title: "Upgrade to keep learning",
    message: "You have used your free credits or reached today's limit. Pick a plan to continue.",
    cta_label: "See plans", cta_url: "/subscribe", show_plans: true, show_offers: true,
  },
};
const int = (v: unknown, d: number) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.floor(Number(v)) : d);
export function normalizeSettings(raw: unknown): MonetizationSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const u = (r.upgrade && typeof r.upgrade === "object" ? r.upgrade : {}) as Record<string, any>;
  const d = DEFAULT_SETTINGS;
  const url = typeof u.cta_url === "string" && u.cta_url.startsWith("/") ? u.cta_url : d.upgrade.cta_url;
  return {
    enabled: r.enabled === true,
    signup_credits: int(r.signup_credits, d.signup_credits),
    signup_credit_expiry_days: int(r.signup_credit_expiry_days, 0),
    monthly_free_credits: int(r.monthly_free_credits, 0),
    upgrade: {
      title: String(u.title ?? d.upgrade.title).slice(0, 120),
      message: String(u.message ?? d.upgrade.message).slice(0, 500),
      cta_label: String(u.cta_label ?? d.upgrade.cta_label).slice(0, 40),
      cta_url: url,
      show_plans: u.show_plans !== false,
      show_offers: u.show_offers !== false,
    },
  };
}
