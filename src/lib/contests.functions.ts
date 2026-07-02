import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Deducts the contest entry fee from the signed-in user's wallet and
 * returns success. RLS ensures the user can only touch their own row.
 * If entry_fee is 0, this is a no-op success.
 */
export const joinContestPay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ contest_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: contest, error: cErr } = await supabase
      .from("contests")
      .select("id, title, entry_fee, active")
      .eq("id", data.contest_id)
      .single();
    if (cErr || !contest) throw new Error("Contest not found");
    if (!contest.active) throw new Error("Contest is not active");

    const fee = Number(contest.entry_fee) || 0;
    if (fee <= 0) return { ok: true, charged: 0 };

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("wallet_balance")
      .eq("id", userId)
      .single();
    if (pErr || !profile) throw new Error("Profile not found");

    const bal = Number(profile.wallet_balance) || 0;
    if (bal < fee) throw new Error("Insufficient wallet balance. Please add money first.");

    const { error: uErr } = await supabase
      .from("profiles")
      .update({ wallet_balance: bal - fee })
      .eq("id", userId);
    if (uErr) throw new Error(uErr.message);

    await supabase.from("transactions").insert({
      user_id: userId,
      type: "debit",
      amount: fee,
      note: `Entry: ${contest.title}`,
    });

    return { ok: true, charged: fee };
  });
