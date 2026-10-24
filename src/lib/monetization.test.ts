import { describe, expect, it } from "vitest";
import { blockMessage, normalizeSettings, parseBlock, DEFAULT_SETTINGS } from "@/lib/monetization";

describe("monetization helpers", () => {
  it("round-trips a block message through parseBlock", () => {
    for (const reason of ["no_credits", "limit_daily", "limit_monthly", "feature_disabled"] as const) {
      expect(parseBlock(new Error(blockMessage(reason, "guru_chat", "Guru.AI chat")))).toEqual({ reason, feature: "guru_chat" });
    }
  });
  it("ignores unrelated errors", () => {
    expect(parseBlock(new Error("Network down"))).toBeNull();
    expect(parseBlock(undefined)).toBeNull();
    expect(parseBlock("plain (code: bogus · x)")).toBeNull();
  });
  it("defaults to disabled and sane values", () => {
    const s = normalizeSettings(null);
    expect(s.enabled).toBe(false);
    expect(s).toEqual(DEFAULT_SETTINGS);
  });
  it("sanitizes bad settings", () => {
    const s = normalizeSettings({ enabled: "yes", signup_credits: -5, monthly_free_credits: "12", upgrade: { cta_url: "https://evil.example", title: "x".repeat(500) } });
    expect(s.enabled).toBe(false);
    expect(s.signup_credits).toBe(DEFAULT_SETTINGS.signup_credits);
    expect(s.monthly_free_credits).toBe(12);
    expect(s.upgrade.cta_url).toBe("/subscribe");
    expect(s.upgrade.title.length).toBe(120);
  });
});
