import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { quizAutogenConfigSchema, parseQuizAutogenConfig, QUIZ_AUTOGEN_SETTING_KEY } from "@/lib/quiz-autogen";

/** Admin-only: current school-contest automation settings plus recent runs (successes, failures, retries). */
export const getQuizAutogen = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const db = supabaseAdmin as any;
    const [{ data: setting }, { data: runs }] = await Promise.all([
      db.from("app_settings").select("value").eq("key", QUIZ_AUTOGEN_SETTING_KEY).maybeSingle(),
      db.from("quiz_autogen_runs").select("slot_key, scope, status, attempts, error, contest_id, question_count, updated_at").order("updated_at", { ascending: false }).limit(25),
    ]);
    return { config: parseQuizAutogenConfig(setting?.value), runs: (runs ?? []) as Array<{ slot_key: string; scope: Record<string, string>; status: string; attempts: number; error: string | null; contest_id: string | null; question_count: number | null; updated_at: string }> };
  });

/** Admin-only: validated on the server; the interval and scopes are stored once and read by the scheduler. */
export const saveQuizAutogen = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => quizAutogenConfigSchema.parse(d))
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("app_settings").upsert({ key: QUIZ_AUTOGEN_SETTING_KEY, value: data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin-only "Run now": same idempotent runner the cron hook uses (still one contest per slot). */
export const runQuizAutogenNow = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { runQuizAutogen, supabaseQuizAutogenStore, aiQuizGenerator } = await import("@/lib/quiz-autogen.server");
    return runQuizAutogen({ store: supabaseQuizAutogenStore(supabaseAdmin as any), generate: aiQuizGenerator, force: true });
  });
