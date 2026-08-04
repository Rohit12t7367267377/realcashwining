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
import { Megaphone, Trash2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { adminListAds, adminSaveAd, adminDeleteAd } from "@/lib/admin-ads.functions";

export const Route = createFileRoute("/admin/ads")({ component: Page });

const empty = {
  title: "", body: "", image_url: "", link_url: "", cta_label: "",
  audience: "all" as "all" | "selected", active: true, starts_at: "", ends_at: "",
  targetUserIds: [] as string[],
};

function Page() {
  const list = useServerFn(adminListAds);
  const save = useServerFn(adminSaveAd);
  const del = useServerFn(adminDeleteAd);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-ads"], queryFn: () => list() });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-ads"] });

  function reset() { setEditingId(null); setForm(empty); }

  function edit(a: any) {
    setEditingId(a.id);
    setForm({
      title: a.title, body: a.body ?? "", image_url: a.image_url ?? "", link_url: a.link_url ?? "",
      cta_label: a.cta_label ?? "", audience: a.audience, active: a.active,
      starts_at: a.starts_at ? a.starts_at.slice(0, 16) : "",
      ends_at: a.ends_at ? a.ends_at.slice(0, 16) : "",
      targetUserIds: a.targets ?? [],
    });
  }

  async function submit() {
    try {
      await save({
        data: {
          ...form,
          id: editingId ?? undefined,
          body: form.body || null,
          image_url: form.image_url || null,
          link_url: form.link_url || null,
          cta_label: form.cta_label || null,
          starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
          ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        },
      });
      toast.success("Saved");
      reset(); refresh();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this ad?")) return;
    try { await del({ data: { id } }); toast.success("Deleted"); refresh(); }
    catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  const users = (data?.users ?? []).filter((u) =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search),
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><Megaphone className="w-6 h-6 text-primary" /> Ads Manager</h1>
        <p className="text-muted-foreground">Run in-app ads for everyone or for specific users.</p>
      </div>

      <Card className="p-4 mb-8 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{editingId ? "Edit ad" : "New ad"}</h2>
          {editingId && <Button size="sm" variant="outline" onClick={reset}><Plus className="w-3.5 h-3.5 mr-1" /> New</Button>}
        </div>
        <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label>Body</Label><Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
          <div><Label>Link URL</Label><Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} /></div>
          <div><Label>CTA label</Label><Input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} placeholder="Learn more" /></div>
          <div>
            <Label>Audience</Label>
            <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as any })}>
              <option value="all">Everyone</option>
              <option value="selected">Selected users</option>
            </select>
          </div>
          <div><Label>Starts at</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
          <div><Label>Ends at</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
        </div>
        <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>

        {form.audience === "selected" && (
          <div>
            <Label>Target users ({form.targetUserIds.length} selected)</Label>
            <Input className="mt-1" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="mt-2 max-h-56 overflow-y-auto rounded-md border p-2 space-y-1">
              {users.map((u) => {
                const on = form.targetUserIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setForm({
                      ...form,
                      targetUserIds: on ? form.targetUserIds.filter((x) => x !== u.id) : [...form.targetUserIds, u.id],
                    })}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm ${on ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    <span>{u.name}</span>
                    <span className="text-xs opacity-70">{u.phone}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Button className="w-full" onClick={submit}>Save ad</Button>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="space-y-2">
        {(data?.ads ?? []).map((a: any) => (
          <Card key={a.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="font-bold">{a.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{a.body}</div>
              <div className="text-xs text-muted-foreground">
                {a.audience === "all" ? "Everyone" : `${a.targets.length} users`} · {a.active ? "Active" : "Paused"}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => edit(a)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button size="sm" variant="outline" onClick={() => remove(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </Card>
        ))}
        {!isLoading && (data?.ads ?? []).length === 0 && <p className="text-sm text-muted-foreground">No ads yet.</p>}
      </div>
    </div>
  );
}
