import { afterEach, describe, expect, it, vi } from "vitest";
import { callAiChat } from "./ai-gateway.server";
import { parseClassroomPreferences } from "./classroom-preferences";

const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: "hi" } }] }), { status: 200 });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("student-selectable AI provider", () => {
  it("defaults to the platform model and keeps old settings valid", () => {
    expect(parseClassroomPreferences({}).aiModel).toBe("default");
    expect(parseClassroomPreferences({ aiModel: "openai" }).aiModel).toBe("openai");
    expect(parseClassroomPreferences({ aiModel: "other" }).aiModel).toBe("default");
  });
  it("sends ChatGPT requests to OpenAI with the server-side key only", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test"); vi.stubEnv("LOVABLE_API_KEY", "lov-test");
    const f = vi.fn(async () => ok()); vi.stubGlobal("fetch", f);
    expect(await callAiChat([{ role: "user", content: "x" }], { provider: "openai", model: "google/gemini-3.7-flash" })).toBe("hi");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(JSON.parse(String(init.body)).model).not.toContain("gemini");
  });
  it("keeps using the Lovable gateway by default", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "lov-test"); vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("AI_PROVIDER", "");
    const f = vi.fn(async () => ok()); vi.stubGlobal("fetch", f);
    await callAiChat([{ role: "user", content: "x" }], {});
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain("ai.gateway.lovable.dev");
  });
  it("uses the owner's own OpenAI key for every AI call once it is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-own"); vi.stubEnv("LOVABLE_API_KEY", "lov-test"); vi.stubEnv("AI_PROVIDER", "");
    const f = vi.fn(async () => ok()); vi.stubGlobal("fetch", f);
    await callAiChat([{ role: "user", content: "x" }], {});
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://api.openai.com/v1/chat/completions");
  });
  it("AI_PROVIDER=lovable keeps the gateway even when an OpenAI key exists", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-own"); vi.stubEnv("LOVABLE_API_KEY", "lov-test"); vi.stubEnv("AI_PROVIDER", "lovable");
    const f = vi.fn(async () => ok()); vi.stubGlobal("fetch", f);
    await callAiChat([{ role: "user", content: "x" }], {});
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain("ai.gateway.lovable.dev");
  });
  it("fails clearly (no silent fallback) when ChatGPT is chosen but no key is set", async () => {
    vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("LOVABLE_API_KEY", "lov-test");
    await expect(callAiChat([{ role: "user", content: "x" }], { provider: "openai" })).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
