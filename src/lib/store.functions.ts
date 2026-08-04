import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Public: active products admin is selling in the Elite Hub. */
export const listStoreProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("store_products")
    .select("id, title, description, image_url, price, currency, stock, unlimited_stock, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

/** My orders + prize awards (both are admin-controlled deliveries). */
export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: orders }, { data: prizes }] = await Promise.all([
      supabase
        .from("store_orders")
        .select("id, quantity, amount, currency, status, admin_note, created_at, product_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("prize_awards")
        .select("id, period, period_key, rank, kind, amount, description, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    const ids = Array.from(new Set((orders ?? []).map((o) => o.product_id)));
    let titles: Record<string, string> = {};
    if (ids.length) {
      const { data: prods } = await supabase.from("store_products").select("id, title").in("id", ids);
      titles = Object.fromEntries((prods ?? []).map((p) => [p.id, p.title]));
    }
    return {
      orders: (orders ?? []).map((o) => ({ ...o, title: titles[o.product_id] ?? "Product" })),
      prizes: prizes ?? [],
    };
  });

/** Buy a product: wallet is debited immediately, admin fulfils the order. */
export const buyStoreProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(10).default(1),
        note: z.string().trim().max(400).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: product, error: perr } = await supabaseAdmin
      .from("store_products")
      .select("*")
      .eq("id", data.product_id)
      .maybeSingle();
    if (perr) throw new Error(perr.message);
    if (!product || !product.active) throw new Error("This product is not available.");
    if (!product.unlimited_stock && Number(product.stock) < data.quantity) {
      throw new Error("Out of stock.");
    }

    const amount = Number(product.price) * data.quantity;
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("wallet_balance, banned")
      .eq("id", userId)
      .single();
    if (profErr) throw new Error(profErr.message);
    if (prof.banned) throw new Error("Your account is suspended. Contact support.");
    if (Number(prof.wallet_balance) < amount) throw new Error("Insufficient wallet balance.");

    const newBal = Number(prof.wallet_balance) - amount;
    const { error: uerr } = await supabaseAdmin
      .from("profiles")
      .update({ wallet_balance: newBal })
      .eq("id", userId);
    if (uerr) throw new Error(uerr.message);

    const { data: order, error: oerr } = await supabaseAdmin
      .from("store_orders")
      .insert({
        user_id: userId,
        product_id: product.id,
        quantity: data.quantity,
        amount,
        currency: product.currency,
        note: data.note ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (oerr) {
      await supabaseAdmin.from("profiles").update({ wallet_balance: Number(prof.wallet_balance) }).eq("id", userId);
      throw new Error(oerr.message);
    }

    if (!product.unlimited_stock) {
      await supabaseAdmin
        .from("store_products")
        .update({ stock: Math.max(0, Number(product.stock) - data.quantity) })
        .eq("id", product.id);
    }

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "debit",
      amount,
      note: `Elite Hub order — ${product.title}`,
    });

    return { ok: true, order, newBalance: newBal };
  });
