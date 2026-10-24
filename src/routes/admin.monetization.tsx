import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import {
  adminMonOverview, adminMonSaveSettings, adminMonSaveFeature, adminMonSavePlan, adminMonSaveOffer, adminMonDeleteOffer,
  adminMonSearchUsers, adminMonGrant, adminMonLedger, adminMonRunMaintenance,
} from "@/lib/monetization.functions";
import type { MonetizationSettings } from "@/lib/monetization";

export const Route = createFileRoute("/admin/monetization")({
  head: () => ({ meta: [{ title: "Admin · AI Credits & Plans" }] }),
  component: Page,
});

const num = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.floor(Number(v) || 0)));
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Failed");

function Page() {
  const overview = useServerFn(adminMonOverview);
  const q = useQuery({ queryKey: ["admin-mon"], queryFn: () => overview() });
  const refresh = () => q.refetch();
  if (q.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (q.error) return <Card className="p-4 text-sm text-destructive">{errMsg(q.error)}</Card>;
  const d = q.data!;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Zap className="w-6 h-6 text-primary" /> AI Credits &amp; Plans</h1>
        <p className="text-muted-foreground">One place for free credits, feature costs, limits, plans, offers and credit history. Every rule applies to all users.</p>
      </div>
      <Stats d={d} />
      <Tabs defaultValue="settings">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="users">Users &amp; credits</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="tx">Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="settings"><SettingsTab s={d.settings} onSaved={refresh} /></TabsContent>
        <TabsContent value="features"><FeaturesTab rows={d.features} onSaved={refresh} /></TabsContent>
        <TabsContent value="plans"><PlansTab rows={d.plans} onSaved={refresh} /></TabsContent>
        <TabsContent value="offers"><OffersTab rows={d.offers} plans={d.plans} onSaved={refresh} /></TabsContent>
        <TabsContent value="users"><UsersTab onSaved={refresh} /></TabsContent>
        <TabsContent value="usage"><UsageTab d={d} /></TabsContent>
        <TabsContent value="tx"><TxTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stats({ d }: { d: any }) {
  const s = d.stats;
  const items = [
    ["Status", d.settings.enabled ? "ON" : "OFF"], ["Accounts", s.accounts], ["Free credits held", s.free_outstanding], ["Paid credits held", s.paid_outstanding],
    ["Granted (30d)", s.granted_30d], ["Spent (30d)", s.spent_30d], ["Expired (30d)", s.expired_30d], ["Plan revenue (30d)", `₹${s.revenue_30d}`],
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {items.map(([k, v]) => (
        <Card key={String(k)} className="p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="text-lg font-bold">{String(v)}</div></Card>
      ))}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}{hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}</div>;
}

function SettingsTab({ s, onSaved }: { s: MonetizationSettings; onSaved: () => void }) {
  const [f, setF] = useState<MonetizationSettings>(s);
  useEffect(() => setF(s), [s]);
  const save = useServerFn(adminMonSaveSettings);
  const run = useServerFn(adminMonRunMaintenance);
  const m = useMutation({ mutationFn: () => save({ data: f }), onSuccess: () => { toast.success("Saved"); onSaved(); }, onError: (e) => toast.error(errMsg(e)) });
  const maint = useMutation({ mutationFn: () => run(), onSuccess: (r) => toast.success(`Expired ${r.expired_memberships} plans, ${r.expired_credit_accounts} credit accounts`), onError: (e) => toast.error(errMsg(e)) });
  const set = (p: Partial<MonetizationSettings>) => setF({ ...f, ...p });
  const up = (p: Partial<MonetizationSettings["upgrade"]>) => setF({ ...f, upgrade: { ...f.upgrade, ...p } });
  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div><div className="font-semibold">Credit system enabled</div><p className="text-xs text-muted-foreground">While OFF nothing is charged or limited. Turn ON when plans, costs and limits look right.</p></div>
        <Switch checked={f.enabled} onCheckedChange={(v) => set({ enabled: v })} />
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Field label="Free credits on signup"><Input type="number" min={0} value={f.signup_credits} onChange={(e) => set({ signup_credits: Number(e.target.value) || 0 })} /></Field>
        <Field label="Free credits expire after (days)" hint="0 = never"><Input type="number" min={0} value={f.signup_credit_expiry_days} onChange={(e) => set({ signup_credit_expiry_days: Number(e.target.value) || 0 })} /></Field>
        <Field label="Monthly free refill" hint="Free balance is reset to this each month. 0 = off"><Input type="number" min={0} value={f.monthly_free_credits} onChange={(e) => set({ monthly_free_credits: Number(e.target.value) || 0 })} /></Field>
      </div>
      <div className="space-y-3 rounded-lg border p-3">
        <div className="font-semibold">Upgrade prompt (shown when credits or limits run out)</div>
        <Field label="Title"><Input value={f.upgrade.title} onChange={(e) => up({ title: e.target.value })} /></Field>
        <Field label="Message"><Input value={f.upgrade.message} onChange={(e) => up({ message: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Button label"><Input value={f.upgrade.cta_label} onChange={(e) => up({ cta_label: e.target.value })} /></Field>
          <Field label="Button link (in-app path)"><Input value={f.upgrade.cta_url} onChange={(e) => up({ cta_url: e.target.value })} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.upgrade.show_plans} onCheckedChange={(v) => up({ show_plans: v })} /> Show active plans</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.upgrade.show_offers} onCheckedChange={(v) => up({ show_offers: v })} /> Show active offers</label>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => m.mutate()} disabled={m.isPending}>Save settings</Button>
        <Button variant="outline" onClick={() => maint.mutate()} disabled={maint.isPending}>Run expiry cleanup now</Button>
      </div>
    </Card>
  );
}

function FeaturesTab({ rows, onSaved }: { rows: any[]; onSaved: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Blank limit = unlimited. Cost is charged per request. Free limits apply to users without an active plan.</p>
      {rows.map((r) => <FeatureRow key={r.feature_key} r={r} onSaved={onSaved} />)}
    </div>
  );
}
function FeatureRow({ r, onSaved }: { r: any; onSaved: () => void }) {
  const [f, setF] = useState({ ...r });
  useEffect(() => setF({ ...r }), [r]);
  const save = useServerFn(adminMonSaveFeature);
  const m = useMutation({
    mutationFn: () => save({ data: {
      feature_key: f.feature_key, label: f.label, description: f.description ?? null, enabled: !!f.enabled, credit_cost: Number(f.credit_cost) || 0,
      free_daily_limit: f.free_daily_limit ?? null, free_monthly_limit: f.free_monthly_limit ?? null, paid_daily_limit: f.paid_daily_limit ?? null, paid_monthly_limit: f.paid_monthly_limit ?? null,
      sort_order: f.sort_order ?? 0,
    } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); }, onError: (e) => toast.error(errMsg(e)),
  });
  const lim = (k: string, label: string) => (
    <Field label={label}><Input type="number" min={0} placeholder="∞" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: num(e.target.value) })} /></Field>
  );
  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div><div className="font-semibold">{f.label}</div><div className="text-xs text-muted-foreground">{f.feature_key}{f.description ? ` · ${f.description}` : ""}</div></div>
        <label className="flex items-center gap-2 text-sm">Enabled <Switch checked={!!f.enabled} onCheckedChange={(v) => setF({ ...f, enabled: v })} /></label>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Field label="Credit cost"><Input type="number" min={0} value={f.credit_cost} onChange={(e) => setF({ ...f, credit_cost: Number(e.target.value) || 0 })} /></Field>
        {lim("free_daily_limit", "Free / day")}{lim("free_monthly_limit", "Free / month")}{lim("paid_daily_limit", "Paid / day")}{lim("paid_monthly_limit", "Paid / month")}
      </div>
      <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>Save</Button>
    </Card>
  );
}

function PlansTab({ rows, onSaved }: { rows: any[]; onSaved: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Plans are your existing VIP memberships. Price, duration and perks are edited under VIP Plans; the credit rules are set here. Plan credits are granted every 30 days of an active plan (renewal starts a new cycle) and stop when the plan expires.</p>
      {rows.map((r) => <PlanRow key={r.id} r={r} onSaved={onSaved} />)}
      {rows.length === 0 && <Card className="p-4 text-sm text-muted-foreground">No plans yet. Create one under VIP Plans.</Card>}
    </div>
  );
}
function PlanRow({ r, onSaved }: { r: any; onSaved: () => void }) {
  const [f, setF] = useState({ credits: r.credits_per_cycle, unl: r.unlimited_ai, active: r.active !== false });
  const save = useServerFn(adminMonSavePlan);
  const m = useMutation({
    mutationFn: () => save({ data: { id: r.id, credits_per_cycle: Number(f.credits) || 0, unlimited_ai: f.unl, active: f.active } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); }, onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <Card className="p-3 flex flex-wrap items-end gap-3">
      <div className="min-w-[10rem]"><div className="font-semibold">{r.name}</div><div className="text-xs text-muted-foreground">₹{r.price} · {r.duration_days} days</div></div>
      <Field label="Credits per 30 days"><Input className="w-32" type="number" min={0} value={f.credits} onChange={(e) => setF({ ...f, credits: Number(e.target.value) || 0 })} /></Field>
      <label className="flex items-center gap-2 text-sm">Unlimited AI <Switch checked={f.unl} onCheckedChange={(v) => setF({ ...f, unl: v })} /></label>
      <label className="flex items-center gap-2 text-sm">Active <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></label>
      <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>Save</Button>
    </Card>
  );
}

const emptyOffer = { code: "", title: "", description: "", bonus_credits: 0, plan_id: "", discount_percent: "", ends_at: "", max_redemptions: "", active: true };
function OffersTab({ rows, plans, onSaved }: { rows: any[]; plans: any[]; onSaved: () => void }) {
  const [f, setF] = useState<any>(emptyOffer);
  const save = useServerFn(adminMonSaveOffer);
  const del = useServerFn(adminMonDeleteOffer);
  const m = useMutation({
    mutationFn: () => save({ data: {
      id: f.id, code: f.code, title: f.title, description: f.description || null, bonus_credits: Number(f.bonus_credits) || 0, plan_id: f.plan_id || null,
      discount_percent: f.discount_percent ? Number(f.discount_percent) : null, starts_at: f.starts_at || null, ends_at: f.ends_at ? new Date(f.ends_at).toISOString() : null,
      max_redemptions: f.max_redemptions ? Number(f.max_redemptions) : null, active: !!f.active,
    } }),
    onSuccess: () => { toast.success("Offer saved"); setF(emptyOffer); onSaved(); }, onError: (e) => toast.error(errMsg(e)),
  });
  const rm = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: () => { toast.success("Deleted"); onSaved(); }, onError: (e) => toast.error(errMsg(e)) });
  return (
    <div className="space-y-3">
      <Card className="p-3 space-y-3">
        <div className="font-semibold">{f.id ? "Edit offer" : "New offer"}</div>
        <div className="grid sm:grid-cols-3 gap-2">
          <Field label="Code"><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field>
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Description"><Input value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Bonus credits on claim"><Input type="number" min={0} value={f.bonus_credits} onChange={(e) => setF({ ...f, bonus_credits: e.target.value })} /></Field>
          <Field label="Discount % (shown on plan)"><Input type="number" min={1} max={100} value={f.discount_percent ?? ""} onChange={(e) => setF({ ...f, discount_percent: e.target.value })} /></Field>
          <Field label="Linked plan">
            <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={f.plan_id ?? ""} onChange={(e) => setF({ ...f, plan_id: e.target.value })}>
              <option value="">None</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Ends at"><Input type="datetime-local" value={f.ends_at ? String(f.ends_at).slice(0, 16) : ""} onChange={(e) => setF({ ...f, ends_at: e.target.value })} /></Field>
          <Field label="Max claims" hint="Blank = unlimited"><Input type="number" min={1} value={f.max_redemptions ?? ""} onChange={(e) => setF({ ...f, max_redemptions: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm self-end pb-2">Active <Switch checked={!!f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></label>
        </div>
        <div className="flex gap-2"><Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>Save offer</Button>{f.id && <Button size="sm" variant="outline" onClick={() => setF(emptyOffer)}>Cancel</Button>}</div>
      </Card>
      {rows.map((o) => (
        <Card key={o.id} className="p-3 flex items-center justify-between gap-2 flex-wrap">
          <div><div className="font-semibold">{o.title} <span className="text-xs text-muted-foreground">({o.code}){o.active ? "" : " · off"}</span></div>
            <div className="text-xs text-muted-foreground">+{o.bonus_credits} credits · claimed {o.redeemed_count}{o.max_redemptions ? `/${o.max_redemptions}` : ""}{o.ends_at ? ` · ends ${new Date(o.ends_at).toLocaleDateString()}` : ""}</div></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setF({ ...o })}>Edit</Button><Button size="sm" variant="outline" onClick={() => rm.mutate(o.id)}>Delete</Button></div>
        </Card>
      ))}
    </div>
  );
}

function UsersTab({ onSaved }: { onSaved: () => void }) {
  const search = useServerFn(adminMonSearchUsers);
  const grant = useServerFn(adminMonGrant);
  const [term, setTerm] = useState("");
  const [found, setFound] = useState<any[]>([]);
  const [amount, setAmount] = useState("50");
  const [bucket, setBucket] = useState<"free" | "paid">("paid");
  const [note, setNote] = useState("Admin credit");
  const [audience, setAudience] = useState<"all" | "free" | "subscribers">("free");
  const find = useMutation({ mutationFn: () => search({ data: { q: term } }), onSuccess: setFound, onError: (e) => toast.error(errMsg(e)) });
  const give = useMutation({
    mutationFn: (target: { user_id: string } | { audience: "all" | "free" | "subscribers" }) => grant({ data: { target, amount: Math.trunc(Number(amount)), bucket, note } }),
    onSuccess: (r) => { toast.success(`Updated ${r.affected} account(s)`); onSaved(); if (term.length >= 2) find.mutate(); }, onError: (e) => toast.error(errMsg(e)),
  });
  return (
    <div className="space-y-3">
      <Card className="p-3 grid sm:grid-cols-4 gap-2 items-end">
        <Field label="Credits (negative removes)"><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Credit type">
          <select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={bucket} onChange={(e) => setBucket(e.target.value as any)}>
            <option value="paid">Paid (never resets)</option><option value="free">Free (follows free expiry/reset)</option>
          </select>
        </Field>
        <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </Card>
      <Card className="p-3 space-y-2">
        <div className="font-semibold text-sm">Give to a whole audience</div>
        <div className="flex gap-2 flex-wrap items-center">
          <select className="h-10 rounded-md border bg-background px-2 text-sm" value={audience} onChange={(e) => setAudience(e.target.value as any)}>
            <option value="free">Free users</option><option value="subscribers">Subscribers</option><option value="all">Everyone</option>
          </select>
          <Button onClick={() => { if (confirm(`Apply ${amount} credits to ${audience} users?`)) give.mutate({ audience }); }} disabled={give.isPending}>Apply to audience</Button>
        </div>
      </Card>
      <Card className="p-3 space-y-2">
        <div className="font-semibold text-sm">Find a user (name, username or phone)</div>
        <div className="flex gap-2"><Input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && term.length >= 2 && find.mutate()} /><Button onClick={() => find.mutate()} disabled={term.length < 2 || find.isPending}>Search</Button></div>
        {found.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-2 border-t pt-2 text-sm">
            <div><div className="font-medium">{u.full_name || u.username || u.id.slice(0, 8)}</div><div className="text-xs text-muted-foreground">free {u.free} · paid {u.paid}</div></div>
            <Button size="sm" variant="outline" onClick={() => give.mutate({ user_id: u.id })}>Apply credits</Button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function UsageTab({ d }: { d: any }) {
  const rows = d.features.map((f: any) => ({ key: f.feature_key, label: f.label, n: d.stats.usage_by_feature[f.feature_key] ?? 0 }));
  const max = Math.max(1, ...rows.map((r: any) => r.n));
  return (
    <Card className="p-4 space-y-2">
      <div className="font-semibold">Requests per feature (last 30 days)</div>
      {rows.map((r: any) => (
        <div key={r.key} className="space-y-0.5">
          <div className="flex justify-between text-sm"><span>{r.label}</span><span className="font-mono">{r.n}</span></div>
          <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(r.n / max) * 100}%` }} /></div>
        </div>
      ))}
    </Card>
  );
}

function TxTab() {
  const fn = useServerFn(adminMonLedger);
  const [kind, setKind] = useState("");
  const q = useQuery({ queryKey: ["admin-mon-ledger", kind], queryFn: () => fn({ data: { kind: kind || undefined, limit: 80 } }) });
  return (
    <div className="space-y-3">
      <select className="h-10 rounded-md border bg-background px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="">All credit events</option>
        {["signup", "monthly_reset", "plan", "admin", "usage", "expiry", "offer", "refund"].map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground border-b"><th className="p-2">When</th><th>User</th><th>Event</th><th>Δ</th><th>Bucket</th><th>Feature / note</th></tr></thead>
          <tbody>
            {(q.data?.ledger ?? []).map((r: any) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td><td>{r.user}</td><td>{r.kind}</td>
                <td className={r.delta < 0 ? "text-destructive" : "text-emerald-600"}>{r.delta > 0 ? `+${r.delta}` : r.delta}</td><td>{r.bucket}</td><td className="text-xs text-muted-foreground">{r.feature_key ?? r.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="font-semibold text-sm">Plan payments</div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground border-b"><th className="p-2">When</th><th>Plan</th><th>Amount</th><th>Status</th><th>Provider</th></tr></thead>
          <tbody>
            {(q.data?.payments ?? []).map((p: any) => (
              <tr key={p.id} className="border-b last:border-0"><td className="p-2 whitespace-nowrap">{new Date(p.created_at).toLocaleString()}</td><td>{p.plan ?? "-"}</td><td>₹{p.amount}</td><td>{p.status}</td><td>{p.provider}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
