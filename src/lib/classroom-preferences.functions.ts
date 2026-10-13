import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classroomPreferencesSchema, parseClassroomPreferences } from "@/lib/classroom-preferences";

export const loadClassroomPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("guru_student_xp")
      .select("classroom_preferences").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return parseClassroomPreferences(data?.classroom_preferences);
  });

export const saveClassroomPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value) => classroomPreferencesSchema.parse(value))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("guru_student_xp")
      .upsert({ user_id: context.userId, classroom_preferences: data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { saved: true };
  });