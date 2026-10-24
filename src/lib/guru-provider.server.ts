import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { defaultAiProvider } from "@/lib/ai-gateway.server";

/** Which AI model teaches Guru.AI lessons. Chosen by the admin (AI Studio), never by students. */
export async function guruAiProvider(): Promise<"openai" | "lovable"> {
  try {
    const { data } = await (supabaseAdmin as any).from("app_settings").select("value").eq("key", "guru_ai_provider").maybeSingle(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const v = typeof data?.value === "string" ? data.value : (data?.value as { provider?: string } | null)?.provider;
    // The owner's own OPENAI_API_KEY wins whenever it is set (unless AI_PROVIDER=lovable), so credits on the Lovable gateway are never touched.
    return v === "openai" || defaultAiProvider() === "openai" ? "openai" : "lovable";
  } catch { return defaultAiProvider(); }
}
