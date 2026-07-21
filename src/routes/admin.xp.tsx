import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminXpTopUsers, adminGrantXp } from "@/lib/admin-gamification.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/xp")({
  head: () => ({ meta: [{ title: "Admin · XP & Levels" }] }),
  component: AdminXpPage,
});

function AdminXpPage() {
  const qc = useQueryClient();
  const list = useServerFn(adminXpTopUsers);
  const grant = useServerFn(adminGrantXp);
  const { data: rows = [] } = useQuery({ queryKey: ["admin-xp-top"], queryFn: () => list() });

  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState(50);
  const [note, setNote] = useState("Manual grant");

  const grantMut = useMutation({
    mutationFn: () => grant({ data: { user_id: target, amount: Number(amount), note } }),
    onSuccess: () => { toast.success("XP granted"); qc.invalidateQueries({ queryKey: ["admin-xp-top"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold">XP & Levels</h1>
      <p className="text-sm text-muted-foreground">Top ranked users. Grant or deduct XP directly.</p>

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-sm font-bold uppercase">Grant XP</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2"><Label>User ID</Label><Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="uuid" /></div>
          <div><Label>Amount (± int)</Label><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
          <div><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <Button onClick={() => grantMut.mutate()} disabled={grantMut.isPending || !target} className="mt-3 bg-gradient-primary">Grant</Button>
      </section>

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-soft">
        <h2 className="mb-3 text-sm font-bold uppercase">Top Users</h2>
        <div className="space-y-2 max-h-[65vh] overflow-auto">
          {rows.map((r, i) => (
            <div key={r.user_id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-bold">#{i + 1} · {r.full_name ?? "Player"}</div>
                <div className="text-[11px] text-muted-foreground">{r.phone ?? "—"} · <button className="underline" onClick={() => { void navigator.clipboard.writeText(r.user_id); toast.success("ID copied"); }}>{r.user_id.slice(0,8)}…</button></div>
              </div>
              <div className="text-right text-xs">
                <div className="font-black">{r.xp} XP</div>
                <div className="text-muted-foreground">Lv {r.level} · {r.boxes_earned} boxes</div>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-center text-sm text-muted-foreground">No users yet.</p>}
        </div>
      </section>
    </AdminShell>
  );
}
