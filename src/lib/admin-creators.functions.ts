import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export const adminListCreators = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const { data: creators } = await supabaseAdmin
      .from("creator_profiles")
      .select("*")
      .order("updated_at", { ascending: false });
    const ids = (creators ?? []).map((c) => c.user_id);
    let names: Record<string, string> = {};
    let kyc: Record<string, string> = {};
    if (ids.length) {
      const [{ data: profs }, { data: kycRows }] = await Promise.all([
        supabaseAdmin.from("profiles").select("id, full_name, username").in("id", ids),
        supabaseAdmin.from("kyc_submissions").select("user_id, status").in("user_id", ids),
      ]);
      names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || p.username || p.id.slice(0, 8)]));
      (kycRows ?? []).forEach((k) => {
        kyc[k.user_id] = k.status;
      });
    }
    return (creators ?? []).map((c) => ({
      ...c,
      name: names[c.user_id] ?? c.user_id.slice(0, 8),
      watchHours: Math.round((Number(c.watch_seconds) / 3600) * 10) / 10,
      kycStatus: kyc[c.user_id] ?? "none",
    }));
  });

export const adminSetMonetization = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["none", "pending", "approved", "rejected"]),
        monetized: z.boolean(),
        admin_note: z.string().trim().max(400).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (data.monetized) {
      const { data: kyc } = await supabaseAdmin
        .from("kyc_submissions")
        .select("status")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!kyc || kyc.status !== "approved") {
        throw new Error("KYC must be approved before enabling monetization for this creator.");
      }
    }
    const { error } = await supabaseAdmin.from("creator_profiles").upsert(
      {
        user_id: data.userId,
        status: data.status,
        monetized: data.monetized,
        admin_note: data.admin_note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
