import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const productSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional().nullable(),
  image_url: z.string().trim().max(600).optional().nullable(),
  price: z.number().min(0).max(1000000),
  currency: z.enum(["cash", "coins"]).default("cash"),
  stock: z.number().int().min(0).max(1000000).default(0),
  unlimited_stock: z.boolean().default(false),
  active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

export const adminListStore = createServerFn({ method: "GET" })
  .middleware([requireAdminPassword])
  .handler(async () => {
    const [{ data: products }, { data: orders }] = await Promise.all([
      supabaseAdmin.from("store_products").select("*").order("sort_order").order("created_at", { ascending: false }),
      supabaseAdmin.from("store_orders").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    const userIds = Array.from(new Set((orders ?? []).map((o) => o.user_id)));
    const productIds = Array.from(new Set((orders ?? []).map((o) => o.product_id)));
    const [{ data: profs }, { data: prods }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, full_name, username, phone").in("id", userIds)
        : Promise.resolve({ data: [] as any[] }),
      productIds.length
        ? supabaseAdmin.from("store_products").select("id, title").in("id", productIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
    const prodMap = new Map((prods ?? []).map((p) => [p.id, p.title]));
    return {
      products: products ?? [],
      orders: (orders ?? []).map((o) => ({
        ...o,
        buyer: pmap.get(o.user_id)?.full_name || pmap.get(o.user_id)?.username || o.user_id.slice(0, 8),
        buyerPhone: pmap.get(o.user_id)?.phone ?? "",
        productTitle: prodMap.get(o.product_id) ?? "Product",
      })),
    };
  });

export const adminSaveProduct = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => productSchema.parse(d))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const payload = { ...rest, updated_at: new Date().toISOString() };
    if (id) {
      const { error } = await supabaseAdmin.from("store_products").update(payload).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true, id };
    }
    const { data: row, error } = await supabaseAdmin.from("store_products").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("store_products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateOrder = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "fulfilled", "rejected"]),
        admin_note: z.string().trim().max(400).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { data: order, error: oerr } = await supabaseAdmin
      .from("store_orders")
      .select("*")
      .eq("id", data.id)
      .single();
    if (oerr) throw new Error(oerr.message);
    if (order.status !== "pending") throw new Error("This order was already reviewed.");

    if (data.status === "rejected") {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("wallet_balance")
        .eq("id", order.user_id)
        .single();
      if (prof) {
        await supabaseAdmin
          .from("profiles")
          .update({ wallet_balance: Number(prof.wallet_balance) + Number(order.amount) })
          .eq("id", order.user_id);
        await supabaseAdmin.from("transactions").insert({
          user_id: order.user_id,
          type: "credit",
          amount: Number(order.amount),
          note: "Refund — Elite Hub order rejected",
        });
      }
      await supabaseAdmin
        .from("store_products")
        .select("stock, unlimited_stock")
        .eq("id", order.product_id)
        .single()
        .then(async ({ data: p }) => {
          if (p && !p.unlimited_stock) {
            await supabaseAdmin
              .from("store_products")
              .update({ stock: Number(p.stock) + Number(order.quantity) })
              .eq("id", order.product_id);
          }
        });
    }

    const { error } = await supabaseAdmin
      .from("store_orders")
      .update({ status: data.status, admin_note: data.admin_note ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
