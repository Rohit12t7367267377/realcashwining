import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listDeposits, reviewDeposit, listWithdrawals, reviewWithdrawal } from "@/lib/admin-payments.functions";
import { checkIsAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Banknote } from "lucide-react";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — Admin" }] }),
  component: PaymentsAdmin,
});

function PaymentsAdmin() {
  const isAdminFn = useServerFn(checkIsAdmin);
  const nav = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    isAdminFn().then((r) => {
      setAllowed(r.isAdmin);
      if (!r.isAdmin) nav({ to: "/" });
    }).catch(() => nav({ to: "/auth" }));
  }, []);

  if (allowed === null) return <AdminShell><p>Loading…</p></AdminShell>;
  if (!allowed) return null;

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Banknote className="h-7 w-7" /> Payments</h1>
        <p className="text-sm text-muted-foreground">Review deposits and process withdrawals.</p>
      </div>
      <Tabs defaultValue="deposits">
        <TabsList>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
        </TabsList>
        <TabsContent value="deposits"><DepositsPanel /></TabsContent>
        <TabsContent value="withdrawals"><WithdrawalsPanel /></TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function DepositsPanel() {
  const fetchFn = useServerFn(listDeposits);
  const reviewFn = useServerFn(reviewDeposit);
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-deposits", status],
    queryFn: () => fetchFn({ data: { status } }),
  });

  const review = async (id: string, action: "approve" | "reject") => {
    try {
      await reviewFn({ data: { id, action } });
      toast.success(action === "approve" ? "Deposit approved — wallet credited" : "Deposit rejected");
      qc.invalidateQueries({ queryKey: ["admin-deposits"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <div className="space-y-3 mt-4">
      <StatusFilter status={status} onChange={setStatus} options={["pending", "approved", "rejected", "all"]} />
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data?.length === 0 && <p className="text-sm text-muted-foreground">No {status} deposits.</p>}
      {data?.map((d: any) => (
        <Card key={d.id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xl font-bold">₹{Number(d.amount).toFixed(0)}</div>
              <div className="text-sm">{d.profile?.full_name ?? "Unknown user"} <span className="text-muted-foreground">· {d.profile?.phone || "no phone"}</span></div>
              <div className="text-xs text-muted-foreground">UTR: <span className="font-mono">{d.upi_utr}</span></div>
              {d.payer_upi && <div className="text-xs text-muted-foreground">From: {d.payer_upi}</div>}
              <div className="text-[11px] text-muted-foreground">{new Date(d.created_at).toLocaleString()}</div>
              {d.admin_note && <div className="text-xs text-muted-foreground">Note: {d.admin_note}</div>}
            </div>
            {d.status === "pending" ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => review(d.id, "reject")}><XCircle className="h-4 w-4 mr-1" /> Reject</Button>
                <Button size="sm" onClick={() => review(d.id, "approve")}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve & Credit</Button>
              </div>
            ) : (
              <span className={`text-xs font-bold uppercase ${d.status === "approved" ? "text-success" : "text-destructive"}`}>{d.status}</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function WithdrawalsPanel() {
  const fetchFn = useServerFn(listWithdrawals);
  const reviewFn = useServerFn(reviewWithdrawal);
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "paid" | "rejected" | "all">("pending");
  const [refs, setRefs] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals", status],
    queryFn: () => fetchFn({ data: { status: status === "paid" ? "paid" : status } }),
  });

  const act = async (id: string, action: "mark_paid" | "reject") => {
    try {
      await reviewFn({ data: { id, action, payout_ref: refs[id] } });
      toast.success(action === "mark_paid" ? "Marked paid" : "Rejected — wallet refunded");
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  };

  return (
    <div className="space-y-3 mt-4">
      <StatusFilter status={status} onChange={setStatus as any} options={["pending", "paid", "rejected", "all"]} />
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data?.length === 0 && <p className="text-sm text-muted-foreground">No {status} withdrawals.</p>}
      {data?.map((w: any) => (
        <Card key={w.id} className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xl font-bold">₹{Number(w.amount).toFixed(0)} → <span className="font-mono text-base">{w.upi_id}</span></div>
              <div className="text-sm">{w.profile?.full_name ?? "Unknown user"} <span className="text-muted-foreground">· {w.profile?.phone || "no phone"}</span></div>
              <div className="text-[11px] text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
              {w.payout_ref && <div className="text-xs">Ref: <span className="font-mono">{w.payout_ref}</span></div>}
              {w.admin_note && <div className="text-xs text-muted-foreground">Note: {w.admin_note}</div>}
            </div>
            {w.status === "pending" ? (
              <div className="flex flex-col gap-2 w-72">
                <Input placeholder="UPI ref / UTR after paying" value={refs[w.id] ?? ""} onChange={(e) => setRefs({ ...refs, [w.id]: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => act(w.id, "reject")}><XCircle className="h-4 w-4 mr-1" /> Reject & Refund</Button>
                  <Button size="sm" className="flex-1" onClick={() => act(w.id, "mark_paid")}><CheckCircle2 className="h-4 w-4 mr-1" /> Mark Paid</Button>
                </div>
              </div>
            ) : (
              <span className={`text-xs font-bold uppercase ${w.status === "paid" ? "text-success" : "text-destructive"}`}>{w.status}</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function StatusFilter({ status, onChange, options }: { status: string; onChange: (s: any) => void; options: string[] }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${status === o ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}
