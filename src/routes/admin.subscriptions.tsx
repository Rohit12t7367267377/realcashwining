import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Crown, Gem, Plus, Pencil, Trash2, UserPlus, IndianRupee } from "lucide-react";
import {
  adminListPlanFeatures,
  adminUpsertFeature,
  adminDeleteFeature,
  adminSetPlanFeatures,
  adminListSubscribers,
  adminGrantSubscription,
  adminUpdateSubscription,
  adminSubscriptionStats,
} from "@/lib/admin-memberships.functions";

export const Route = createFileRoute("/admin/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions — Admin" }] }),
  component: Page,
});

function Page() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Gem className="h-7 w-7 text-primary" /> Subscriptions</h1>
        <p className="text-muted-foreground">Benefits catalogue, plan benefits, subscribers and revenue — all controlled here.</p>
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="benefits">Benefits</TabsTrigger>
          <TabsTrigger value="plans">Plan benefits</TabsTrigger>
          <TabsTrigger value="subs">Subscribers</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="benefits"><Benefits /></TabsContent>
        <TabsContent value="plans"><PlanBenefits /></TabsContent>
        <TabsContent value="subs"><Subscribers /></TabsContent>
      </Tabs>
    </div>
  );
}

function Overview() {
  const statsFn = useServerFn(adminSubscriptionStats);
  const { data } = useQuery({ queryKey: ["admin-sub-stats"], queryFn: () => statsFn() });
  const cards = [
    { label: "Total revenue", value: `₹${(data?.revenue ?? 0).toFixed(0)}` },
    { label: "This month", value: `₹${(data?.monthRevenue ?? 0).toFixed(0)}` },
    { label: "Active members", value: String(data?.active ?? 0) },
    { label: "Expired", value: String(data?.expired ?? 0) },
  ];
  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-2xl font-black">{c.value}</div>
          </Card>
        ))}
      </div>
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><IndianRupee className="h-4 w-4" /> Revenue by plan</h2>
        <div className="space-y-2 text-sm">
          {(data?.byPlan ?? []).map((r) => (
            <div key={r.plan} className="flex items-center justify-between border-b pb-1">
              <span className="font-medium">{r.plan}</span>
              <span className="text-muted-foreground">{r.count} payment(s) · ₹{r.revenue.toFixed(0)}</span>
            </div>
          ))}
          {!data?.byPlan.length && <p className="text-muted-foreground">No payments yet.</p>}
        </div>
      </Card>
    </div>
  );
}

const emptyFeature = { code: "", name: "", description: "", icon: "sparkles", active: true, sort_order: 0 };

function Benefits() {
  const listFn = useServerFn(adminListPlanFeatures);
  const upsertFn = useServerFn(adminUpsertFeature);
  const delFn = useServerFn(adminDeleteFeature);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-plan-features"], queryFn: () => listFn() });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState<typeof emptyFeature>(emptyFeature);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-plan-features"] });

  async function save() {
    try {
      await upsertFn({ data: { ...(editId ? { id: editId } : {}), ...f, sort_order: Number(f.sort_order) } });
      toast.success("Saved");
      setOpen(false);
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this benefit? It will be removed from every plan.")) return;
    try { await delFn({ data: { id } }); toast.success("Deleted"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => { setEditId(null); setF(emptyFeature); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> New benefit
        </Button>
      </div>
      {(data?.features ?? []).map((ft) => (
        <Card key={ft.id} className="flex items-start justify-between gap-4 p-4">
          <div>
            <div className="font-bold">{ft.name} <span className="font-mono text-xs text-muted-foreground">{ft.code}</span></div>
            <div className="text-sm text-muted-foreground">{ft.description}</div>
            {!ft.active && <span className="text-xs font-bold uppercase text-destructive">inactive</span>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              setEditId(ft.id);
              setF({ code: ft.code, name: ft.name, description: ft.description ?? "", icon: ft.icon, active: ft.active, sort_order: ft.sort_order });
              setOpen(true);
            }}><Pencil className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => remove(ft.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Edit benefit" : "New benefit"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Code (used by the app)</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="unlimited_ai" /></div>
            <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Icon</Label><Input value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} /></div>
              <div><Label>Sort order</Label><Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /><Label>Active</Label></div>
            <Button className="w-full" onClick={save}>Save benefit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlanBenefits() {
  const listFn = useServerFn(adminListPlanFeatures);
  const setFn = useServerFn(adminSetPlanFeatures);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-plan-features"], queryFn: () => listFn() });
  const { data: plans } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => (await supabase.from("memberships").select("id, name, price, duration_days, active").order("sort_order")).data ?? [],
  });
  const [busy, setBusy] = useState<string | null>(null);

  const assigned = (planId: string) => (data?.links ?? []).filter((l) => l.membership_id === planId).map((l) => l.feature_id);

  async function toggle(planId: string, featureId: string) {
    const current = assigned(planId);
    const next = current.includes(featureId) ? current.filter((x) => x !== featureId) : [...current, featureId];
    setBusy(planId + featureId);
    try {
      await setFn({ data: { membership_id: planId, feature_ids: next } });
      await qc.invalidateQueries({ queryKey: ["admin-plan-features"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  return (
    <div className="mt-4 space-y-4">
      {(plans ?? []).map((p) => (
        <Card key={p.id} className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            <span className="font-bold">{p.name}</span>
            <span className="text-xs text-muted-foreground">₹{p.price} · {p.duration_days} days{p.active ? "" : " · inactive"}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.features ?? []).map((ft) => {
              const on = assigned(p.id).includes(ft.id);
              return (
                <label key={ft.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
                  <span>{ft.name}</span>
                  <Switch checked={on} disabled={busy === p.id + ft.id} onCheckedChange={() => toggle(p.id, ft.id)} />
                </label>
              );
            })}
          </div>
        </Card>
      ))}
      {!plans?.length && <p className="text-sm text-muted-foreground">Create a plan first in VIP Memberships.</p>}
    </div>
  );
}

function Subscribers() {
  const listFn = useServerFn(adminListSubscribers);
  const grantFn = useServerFn(adminGrantSubscription);
  const updateFn = useServerFn(adminUpdateSubscription);
  const qc = useQueryClient();
  const [status, setStatus] = useState<"active" | "expired" | "cancelled" | "all">("active");
  const { data } = useQuery({ queryKey: ["admin-subscribers", status], queryFn: () => listFn({ data: { status } }) });
  const { data: plans } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => (await supabase.from("memberships").select("id, name, price, duration_days, active").order("sort_order")).data ?? [],
  });
  const [q, setQ] = useState("");
  const [planId, setPlanId] = useState("");
  const [note, setNote] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-subscribers"] });
    qc.invalidateQueries({ queryKey: ["admin-sub-stats"] });
  };

  async function grant() {
    try {
      const r = await grantFn({ data: { query: q.trim(), membership_id: planId || (plans?.[0]?.id ?? ""), note: note || undefined } });
      toast.success(`${r.user} is premium until ${new Date(r.ends_at).toLocaleDateString()}`);
      setQ(""); setNote(""); refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function act(id: string, action: "cancel" | "reactivate" | "extend", days?: number) {
    try { await updateFn({ data: { id, action, extra_days: days } }); toast.success("Updated"); refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="mt-4 space-y-4">
      <Card className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-bold"><UserPlus className="h-4 w-4" /> Give premium manually</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <Input placeholder="Phone / username / name" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="rounded-md border bg-background px-3 py-2 text-sm" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Choose plan…</option>
            {(plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} · ₹{p.price}</option>)}
          </select>
          <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={grant} disabled={!q.trim() || !planId}>Grant / extend</Button>
        </div>
      </Card>

      <div className="flex gap-2">
        {(["active", "expired", "cancelled", "all"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {(data ?? []).map((s) => (
          <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-bold">{s.user?.full_name || s.user?.username || s.user?.phone || "Unknown user"}</div>
              <div className="text-xs text-muted-foreground">
                {s.plan?.name ?? "Plan removed"} · {s.status}
                {s.ends_at ? ` · till ${new Date(s.ends_at).toLocaleDateString()}` : ""} · via {s.source}
              </div>
              {s.admin_note && <div className="text-xs text-muted-foreground">Note: {s.admin_note}</div>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => act(s.id, "extend", 30)}>+30 days</Button>
              {s.status === "active"
                ? <Button size="sm" variant="outline" onClick={() => act(s.id, "cancel")}>Cancel</Button>
                : <Button size="sm" variant="outline" onClick={() => act(s.id, "reactivate")}>Reactivate</Button>}
            </div>
          </Card>
        ))}
        {!data?.length && <p className="text-sm text-muted-foreground">No {status} subscriptions.</p>}
      </div>
    </div>
  );
}
