import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ShoppingBag, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  adminListStore, adminSaveProduct, adminDeleteProduct, adminUpdateOrder,
} from "@/lib/admin-store.functions";

export const Route = createFileRoute("/admin/store")({ component: Page });

const empty = {
  title: "", description: "", image_url: "", price: 0,
  currency: "cash" as "cash" | "coins", stock: 0, unlimited_stock: false,
  active: true, sort_order: 0,
};

function Page() {
  const list = useServerFn(adminListStore);
  const save = useServerFn(adminSaveProduct);
  const del = useServerFn(adminDeleteProduct);
  const updateOrder = useServerFn(adminUpdateOrder);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-store"], queryFn: () => list() });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-store"] });

  function openNew() { setEditingId(null); setForm(empty); setOpen(true); }
  function openEdit(p: any) {
    setEditingId(p.id);
    setForm({
      title: p.title, description: p.description ?? "", image_url: p.image_url ?? "",
      price: Number(p.price), currency: p.currency, stock: Number(p.stock),
      unlimited_stock: p.unlimited_stock, active: p.active, sort_order: p.sort_order,
    });
    setOpen(true);
  }

  async function submit() {
    try {
      await save({ data: { ...form, id: editingId ?? undefined, description: form.description || null, image_url: form.image_url || null } });
      toast.success("Saved");
      setOpen(false); refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    try { await del({ data: { id } }); toast.success("Deleted"); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function review(id: string, status: "fulfilled" | "rejected") {
    const note = prompt(status === "rejected" ? "Reason for rejection (refunds the user)" : "Delivery note (optional)") ?? "";
    try {
      await updateOrder({ data: { id, status, admin_note: note || null } });
      toast.success(status === "fulfilled" ? "Order fulfilled" : "Order rejected & refunded");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><ShoppingBag className="w-6 h-6 text-primary" /> Store & Orders</h1>
          <p className="text-muted-foreground">Sell products in the Elite Hub and fulfil user orders.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add Product</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="grid gap-3 md:grid-cols-2">
        {(data?.products ?? []).map((p: any) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start gap-3">
              {p.image_url && <img src={p.image_url} alt={p.title} className="h-16 w-16 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="font-bold">{p.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>
                <div className="mt-1 text-sm font-semibold">
                  ₹{Number(p.price).toFixed(0)} · {p.unlimited_stock ? "Unlimited" : `${p.stock} in stock`} · {p.active ? "Active" : "Hidden"}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => remove(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {!isLoading && (data?.products ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No products yet.</p>
        )}
      </div>

      <h2 className="mt-10 mb-3 text-xl font-bold">Orders</h2>
      <div className="space-y-2">
        {(data?.orders ?? []).map((o: any) => (
          <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-semibold">{o.productTitle} × {o.quantity}</div>
              <div className="text-xs text-muted-foreground">
                {o.buyer} {o.buyerPhone && `· ${o.buyerPhone}`} · ₹{Number(o.amount).toFixed(0)} · {new Date(o.created_at).toLocaleString()}
              </div>
              {o.note && <div className="text-xs">Note: {o.note}</div>}
              {o.admin_note && <div className="text-xs text-muted-foreground">Admin: {o.admin_note}</div>}
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold capitalize">{o.status}</span>
              {o.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => review(o.id, "fulfilled")}><Check className="w-3.5 h-3.5 mr-1" /> Fulfil</Button>
                  <Button size="sm" variant="outline" onClick={() => review(o.id, "rejected")}><X className="w-3.5 h-3.5 mr-1" /> Reject</Button>
                </>
              )}
            </div>
          </Card>
        ))}
        {(data?.orders ?? []).length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price (₹)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
              <div><Label>Stock</Label><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} disabled={form.unlimited_stock} /></div>
            </div>
            <div className="flex items-center justify-between"><Label>Unlimited stock</Label><Switch checked={form.unlimited_stock} onCheckedChange={(v) => setForm({ ...form, unlimited_stock: v })} /></div>
            <div className="flex items-center justify-between"><Label>Visible to users</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
            <div><Label>Sort order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            <Button className="w-full" onClick={submit}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
