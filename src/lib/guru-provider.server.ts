import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Which AI model teaches Guru.AI lessons. Chosen by the admin (AI Studio), never by students. */
export async function guruAiProvider(): Promise<"openai" | "lovable"> {
  try {
    const { data } = await (supabaseAdmin as any).from("app_settings").select("value").eq("key", "guru_ai_provider").maybeSingle(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const v = typeof data?.value === "string" ? data.value : (data?.value as { provider?: string } | null)?.provider;
    return v === "openai" ? "openai" : "lovable";
  } catch { return "lovable"; }
}
