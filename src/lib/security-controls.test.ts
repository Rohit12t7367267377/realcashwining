import { describe, expect, it } from "vitest";
import { adminWriteSchemas, catalogWriteSchemas } from "./admin-write-schemas";
import { approvedKnowledgeProvider } from "./knowledge-provider-policy";
import { requirePremiumMembership } from "./premium-access.server";

describe("selected security controls", () => {
  it("rejects server-owned catalog fields", () => {
    expect(() => catalogWriteSchemas.exam.parse({ active: true, id: "attacker" })).toThrow();
    expect(() => catalogWriteSchemas.degree.parse({ created_at: "2026-01-01" })).toThrow();
    expect(catalogWriteSchemas.college_topic.parse({ title: "Algebra", active: true })).toEqual({ title: "Algebra", active: true });
  });
  it("rejects unapproved counters in admin writes", () => {
    expect(() => adminWriteSchemas.coupons.parse({ code: "ABC", kind: "wallet_credit", amount: 10, xp_amount: 0, max_redemptions: null, per_user_limit: 1, expires_at: null, active: true, note: "", redemptions: 0 })).toThrow();
  });
  it("rejects arbitrary origins, credentials and embedded URL credentials", () => {
    expect(() => approvedKnowledgeProvider("openai", "https://evil.example/test")).toThrow();
    expect(() => approvedKnowledgeProvider("openai", "https://api.openai.com.evil.example/test")).toThrow();
    expect(() => approvedKnowledgeProvider("openai", "http://api.openai.com/test")).toThrow();
    expect(() => approvedKnowledgeProvider("openai", "https://api.openai.com/test", "SUPABASE_SERVICE_ROLE_KEY")).toThrow();
    expect(() => approvedKnowledgeProvider("openai", "https://user:pass@api.openai.com/test")).toThrow();
    expect(approvedKnowledgeProvider("openai", "https://api.openai.com/v1/models").url.origin).toBe("https://api.openai.com");
  });
  it("fails closed without current membership or on lookup failure", async () => {
    const db = (result: unknown) => {
      const q: any = { select: () => q, eq: () => q, lte: () => q, gt: () => q, limit: async () => result };
      return { from: () => q } as any;
    };
    await expect(requirePremiumMembership(db({ data: [], error: null }), "user")).rejects.toThrow();
    await expect(requirePremiumMembership(db({ data: null, error: {} }), "user")).rejects.toThrow();
    await expect(requirePremiumMembership(db({ data: [{ id: "valid" }], error: null }), "user")).resolves.toBeUndefined();
  });
});