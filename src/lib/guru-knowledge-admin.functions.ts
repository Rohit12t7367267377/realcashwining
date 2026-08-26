import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";

type Db = { from: (t: string) => any };

/** Never includes api_key / api_secret — credentials stay server-side. */
export type KnowledgeSource = {
  id: string;
  provider: string;
  label: string;
  source_type: string;
  endpoint: string | null;
  description: string | null;
  api_key_secret_name: string | null;
  has_key: boolean;
  status: string;
  enabled: boolean;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
  sort_order: number;
};

export const SOURCE_TYPES = [
  "content_api",
  "ai_model",
  "embeddings",
  "search",
  "sports_data",
  "storage",
  "other",
] as const;

const SAFE_COLUMNS =
  "id, provider, label, source_type, endpoint, description, api_key_secret_name, status, enabled, last_tested_at, last_test_ok, last_test_message, sort_order, api_key";

function toSafe(row: Record<string, unknown>): KnowledgeSource {
  const { api_key, ...rest } = row as Record<string, unknown> & { api_key?: string | null };
  return {
    ...(rest as unknown as Omit<KnowledgeSource, "has_key">),
    has_key: Boolean((api_key ?? "").toString().trim() || rest["api_key_secret_name"]),
  };
}

/** List configured providers. Secrets are stripped before leaving the server. */
export const adminListKnowledgeSources = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const { data, error } = await db
      .from("guru_knowledge_sources")
      .select(SAFE_COLUMNS)
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map(toSafe);
  });

/** Create or update a provider. An empty api_key leaves the stored one untouched. */
export const adminSaveKnowledgeSource = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        provider: z.string().trim().min(2).max(80),
        label: z.string().trim().min(2).max(120),
        source_type: z.enum(SOURCE_TYPES).default("content_api"),
        endpoint: z.string().trim().max(600).optional().or(z.literal("")),
        description: z.string().trim().max(2000).optional().or(z.literal("")),
        api_key_secret_name: z.string().trim().max(120).optional().or(z.literal("")),
        api_key: z.string().trim().max(400).optional().or(z.literal("")),
        api_secret: z.string().trim().max(400).optional().or(z.literal("")),
        enabled: z.boolean().default(false),
        sort_order: z.number().int().min(0).max(999).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const clean = (v?: string) => {
      const t = (v ?? "").trim();
      return t.length ? t : null;
    };
    const row: Record<string, unknown> = {
      provider: data.provider.trim(),
      label: data.label.trim(),
      source_type: data.source_type,
      endpoint: clean(data.endpoint),
      description: clean(data.description),
      api_key_secret_name: clean(data.api_key_secret_name),
      enabled: data.enabled,
      sort_order: data.sort_order,
    };
    // Only overwrite credentials when new ones were actually typed in.
    if (clean(data.api_key)) row["api_key"] = clean(data.api_key);
    if (clean(data.api_secret)) row["api_secret"] = clean(data.api_secret);
    if (clean(data.api_key) || clean(data.api_key_secret_name)) row["status"] = "configured";

    if (data.id) {
      const { error } = await db.from("guru_knowledge_sources").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      await db.from("guru_audit_logs").insert({ action: "knowledge_source.update", entity: "guru_knowledge_sources", entity_id: data.id });
      return { id: data.id, created: false };
    }
    const { data: created, error } = await db
      .from("guru_knowledge_sources")
      .insert({ ...row, status: row["status"] ?? "not_configured" })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const id = (created as { id: string } | null)?.id ?? "";
    await db.from("guru_audit_logs").insert({ action: "knowledge_source.create", entity: "guru_knowledge_sources", entity_id: id });
    return { id, created: true };
  });

export const adminToggleKnowledgeSource = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const { error } = await db.from("guru_knowledge_sources").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteKnowledgeSource = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const { error } = await db.from("guru_knowledge_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Real connection test: calls the provider's endpoint from the server with the
 * stored credential (or a backend environment secret by name). No fabricated
 * success — the actual HTTP status is recorded.
 */
export const adminTestKnowledgeSource = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const { data: row, error } = await db
      .from("guru_knowledge_sources")
      .select("id, provider, endpoint, api_key, api_key_secret_name, source_type")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const src = row as {
      id: string;
      provider: string;
      endpoint: string | null;
      api_key: string | null;
      api_key_secret_name: string | null;
      source_type: string;
    } | null;
    if (!src) throw new Error("Provider not found");

    const envKey = src.api_key_secret_name ? process.env[src.api_key_secret_name] : undefined;
    const key = (src.api_key ?? envKey ?? "").trim();

    let ok = false;
    let message = "";
    if (!src.endpoint) {
      message = "No endpoint configured — add the provider's test URL first.";
    } else if (!key && src.source_type !== "search") {
      message = "No credential available. Paste a key, or set a backend secret and reference its name.";
    } else {
      try {
        const url = new URL(src.endpoint);
        const res = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(key ? { Authorization: `Bearer ${key}`, "x-api-key": key } : {}),
          },
        });
        ok = res.ok;
        message = ok
          ? `Connected (HTTP ${res.status})`
          : `Provider responded HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}`;
      } catch (e) {
        message = e instanceof Error ? `Request failed: ${e.message}` : "Request failed";
      }
    }

    await db
      .from("guru_knowledge_sources")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_ok: ok,
        last_test_message: message,
        status: ok ? "connected" : key ? "error" : "not_configured",
      })
      .eq("id", src.id);

    return { ok, message };
  });

/** Indexing status for the AI Knowledge dashboard. */
export const adminKnowledgeStatus = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const chunks = await db.from("guru_ai_sources").select("id", { count: "exact", head: true });
    const embedded = await db.from("guru_ai_sources").select("id", { count: "exact", head: true }).not("embedding", "is", null);
    const resources = await db.from("guru_resources").select("id", { count: "exact", head: true }).eq("active", true);
    const indexedResources = await db.from("guru_resources").select("id", { count: "exact", head: true }).gt("chunk_count", 0);
    return {
      chunks: Number(chunks.count ?? 0),
      embedded: Number(embedded.count ?? 0),
      resources: Number(resources.count ?? 0),
      indexedResources: Number(indexedResources.count ?? 0),
      aiConfigured: Boolean(process.env.LOVABLE_API_KEY),
      embedModel: "openai/text-embedding-3-small",
    };
  });
