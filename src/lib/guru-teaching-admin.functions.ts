import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminPassword } from "@/lib/admin-auth";

type Db = { from: (t: string) => any };

type Row = Record<string, string | number | boolean | null | string[]>;

const SCOPES = ["school", "college", "exam", "skill", "galaxy", "universal", "library", "classroom"] as const;

/* ------------------------------ voices ------------------------------ */

export const adminListVoices = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as never as Db)
      .from("guru_voices")
      .select("*")
      .order("sort_order")
      .order("label");
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  });

export const adminSaveVoice = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().trim().min(2).max(60),
        label: z.string().trim().min(1).max(80),
        provider: z.string().trim().min(2).max(40).default("lovable"),
        voice_id: z.string().trim().min(1).max(120),
        language: z.string().trim().max(10).default("en"),
        accent: z.string().trim().max(40).optional().nullable(),
        gender: z.string().trim().max(20).optional().nullable(),
        style: z.string().trim().max(60).optional().nullable(),
        speed: z.number().min(0.5).max(1.5).default(1),
        is_default: z.boolean().default(false),
        active: z.boolean().default(true),
        sort_order: z.number().int().min(0).max(9999).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const { id, ...row } = data;
    const q = id
      ? db.from("guru_voices").update(row).eq("id", id)
      : db.from("guru_voices").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteVoice = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as never as Db).from("guru_voices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------- teaching configs -------------------------- */

export const adminListTeachingConfigs = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const [{ data: configs, error }, { data: characters }] = await Promise.all([
      db.from("guru_teaching_configs").select("*").order("priority", { ascending: false }).order("title"),
      db.from("guru_characters").select("id, name, subject_specialization").eq("active", true).order("sort_order"),
    ]);
    if (error) throw new Error(error.message);
    return {
      configs: (configs ?? []) as Row[],
      characters: (characters ?? []) as Row[],
    };
  });

export const adminSaveTeachingConfig = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(140),
        scope: z.enum(SCOPES),
        ref_id: z.string().uuid().nullable().optional(),
        topic_key: z.string().trim().max(200).nullable().optional(),
        character_id: z.string().uuid().nullable().optional(),
        voice_code: z.string().trim().max(60).nullable().optional(),
        teaching_mode: z.string().trim().max(40).default("interactive"),
        board_type: z.string().trim().max(40).default("whiteboard"),
        tools: z.array(z.string().trim().max(60)).max(20).default([]),
        lesson_structure: z.array(z.string().trim().max(80)).max(20).default([]),
        difficulty: z.string().trim().max(40).nullable().optional(),
        language: z.enum(["en", "hi"]).default("en"),
        access: z.enum(["free", "premium"]).default("free"),
        extra_instructions: z.string().trim().max(3000).nullable().optional(),
        priority: z.number().int().min(0).max(999).default(0),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as never as Db;
    const { id, ...row } = data;
    const payload = {
      ...row,
      topic_key: row.topic_key?.trim() ? row.topic_key.trim().toLowerCase() : null,
      ref_id: row.ref_id || null,
      character_id: row.character_id || null,
      voice_code: row.voice_code || null,
      difficulty: row.difficulty || null,
      extra_instructions: row.extra_instructions || null,
    };
    const { error } = id
      ? await db.from("guru_teaching_configs").update(payload).eq("id", id)
      : await db.from("guru_teaching_configs").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminToggleTeachingConfig = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as never as Db)
      .from("guru_teaching_configs")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteTeachingConfig = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as never as Db)
      .from("guru_teaching_configs")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
