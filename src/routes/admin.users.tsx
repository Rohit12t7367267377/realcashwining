import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUsersAdmin, adjustWallet, toggleBan, setUserRole } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, Ban, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/users")({ component: Page });

type Row = {
  id: string; email: string; created_at: string;
  profile: { full_name: string | null; phone: string | null; wallet_balance: number; banned: boolean; referral_code: string | null } | null;
  roles: string[];
};

function Page() {
  const list = useServerFn(listUsersAdmin);
  const adj = useServerFn(adjustWallet);
  const ban = useServerFn(toggleBan);
  const role = useServerFn(setUserRole);

  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [walletFor, setWalletFor] = useState<Row | null>(null);
  const [amt, setAmt] = useState(0);
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await list();
      setRows(data as Row[]);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => (r.email + " " + (r.profile?.full_name ?? "") + " " + (r.profile?.phone ?? "")).toLowerCase().includes(q.toLowerCase()));

  async function doAdjust() {
    if (!walletFor || !amt || !note.trim()) return toast.error("Amount & note required");
    try { await adj({ data: { userId: walletFor.id, amount: amt, note } }); toast.success("Wallet updated"); setWalletFor(null); setAmt(0); setNote(""); load(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function doBan(r: Row) {
    try { await ban({ data: { userId: r.id, banned: !(r.profile?.banned) } }); toast.success("Updated"); load(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function doRole(r: Row) {
    const isAdmin = r.roles.includes("admin");
    if (isAdmin && !confirm("Remove admin role?")) return;
    try { await role({ data: { userId: r.id, makeAdmin: !isAdmin } }); toast.success("Updated"); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Users & Wallets</h1>
          <p className="text-muted-foreground">All registered accounts.</p>
        </div>
        <Input placeholder="Search email/name/phone…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>

      {loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div> : (
        <Card className="divide-y">
          {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground">No users.</div>}
          {filtered.map((r) => {
            const isAdmin = r.roles.includes("admin");
            return (
              <div key={r.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium flex items-center gap-2">
                    {r.profile?.full_name || r.email}
                    {isAdmin && <Badge>Admin</Badge>}
                    {r.profile?.banned && <Badge variant="destructive">Banned</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{r.email} · {r.profile?.phone || "—"} · code {r.profile?.referral_code || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">₹{Number(r.profile?.wallet_balance ?? 0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">wallet</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setWalletFor(r); setAmt(0); setNote(""); }}><Wallet className="w-4 h-4 mr-1" /> Adjust</Button>
                  <Button size="sm" variant="outline" onClick={() => doRole(r)} title={isAdmin ? "Revoke admin" : "Make admin"}>
                    {isAdmin ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => doBan(r)} title={r.profile?.banned ? "Unban" : "Ban"}>
                    <Ban className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Dialog open={!!walletFor} onOpenChange={(o) => !o && setWalletFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust wallet — {walletFor?.email}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Current: ₹{Number(walletFor?.profile?.wallet_balance ?? 0).toFixed(2)}</div>
            <div><Label>Amount (use negative to deduct)</Label><Input type="number" value={amt} onChange={(e) => setAmt(Number(e.target.value))} /></div>
            <div><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Refund, bonus, correction…" /></div>
            <Button className="w-full" onClick={doAdjust}>Apply</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
