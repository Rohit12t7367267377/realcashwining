import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { listStoreProducts, listMyOrders, buyStoreProduct } from "@/lib/store.functions";
import { ShoppingBag, Package, Gift } from "lucide-react";
import { toast } from "sonner";

/** Admin-managed store inside the Elite Hub: buy products, track orders & prizes. */
export function StoreSection() {
  const qc = useQueryClient();
  const fetchProducts = useServerFn(listStoreProducts);
  const fetchOrders = useServerFn(listMyOrders);
  const buy = useServerFn(buyStoreProduct);

  const { data: products = [] } = useQuery({
    queryKey: ["store-products"],
    queryFn: () => fetchProducts(),
    staleTime: 60_000,
  });
  const { data: mine } = useQuery({ queryKey: ["my-orders"], queryFn: () => fetchOrders(), staleTime: 30_000 });

  const order = useMutation({
    mutationFn: (product_id: string) => buy({ data: { product_id, quantity: 1 } }),
    onSuccess: () => {
      toast.success("Order placed — admin will fulfil it shortly.");
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["store-products"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not place order"),
  });

  const orders = mine?.orders ?? [];
  const prizes = mine?.prizes ?? [];

  return (
    <>
      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          <ShoppingBag className="h-4 w-4" /> Elite Store
        </h2>
        {products.length === 0 ? (
          <p className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground shadow-soft">
            No products on sale right now. New drops appear here instantly.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => {
              const out = !p.unlimited_stock && Number(p.stock) <= 0;
              return (
                <div key={p.id} className="card-lift overflow-hidden rounded-2xl bg-card shadow-soft">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} loading="lazy" className="h-28 w-full object-cover" />
                  ) : (
                    <div className="grid h-28 w-full place-items-center bg-muted text-muted-foreground">
                      <Package className="h-7 w-7" />
                    </div>
                  )}
                  <div className="p-3">
                    <div className="truncate text-sm font-black">{p.title}</div>
                    {p.description && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{p.description}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-primary">₹{Number(p.price).toFixed(0)}</span>
                      <Button
                        size="sm"
                        className="press bg-gradient-primary"
                        disabled={out || order.isPending}
                        onClick={() => order.mutate(p.id)}
                      >
                        {out ? "Sold out" : "Buy"}
                      </Button>
                    </div>
                    {!p.unlimited_stock && !out && (
                      <div className="mt-1 text-[10px] text-muted-foreground">{p.stock} left</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {(orders.length > 0 || prizes.length > 0) && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <Gift className="h-4 w-4" /> My orders &amp; prizes
          </h2>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 shadow-soft">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{o.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    ₹{Number(o.amount).toFixed(0)} · {new Date(o.created_at).toLocaleDateString()}
                    {o.admin_note ? ` · ${o.admin_note}` : ""}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                  {o.status}
                </span>
              </div>
            ))}
            {prizes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 shadow-soft">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">
                    {p.period} prize · rank #{p.rank}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {p.kind}
                    {Number(p.amount) > 0 ? ` · ${Number(p.amount).toFixed(0)}` : ""}
                    {p.description ? ` · ${p.description}` : ""}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-gradient-gold px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
