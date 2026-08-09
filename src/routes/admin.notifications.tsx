import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Send, Trash2, Clock, Users, Smartphone, RefreshCw, Search } from "lucide-react";
import {
  adminListCampaigns,
  adminSaveCampaign,
  adminSendCampaign,
  adminDeleteCampaign,
  adminCampaignDeliveries,
  adminSearchUsers,
} from "@/lib/admin-notifications.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/notifications")({
  component: AdminNotificationsPage,
  head: () => ({
    meta: [
      { title: "Push Notifications — CWL Admin" },
      { name: "description", content: "Send instant or scheduled push notifications to your quiz players." },
      { property: "og:title", content: "Push Notifications — CWL Admin" },
      { property: "og:description", content: "Target all users, premium members, a category or specific players." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Audience = "all" | "selected" | "premium" | "category" | "contest";

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "all", label: "All users" },
  { value: "premium", label: "Premium members" },
  { value: "category", label: "Category players" },
  { value: "contest", label: "Contest participants" },
  { value: "selected", label: "Selected users" },
];

function AdminNotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ tokens: 0, activeTokens: 0, pushConfigured: false });
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [contests, setContests] = useState<any[]>([]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [categoryId, setCategoryId] = useState("");
  const [contestId, setContestId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<{ id: string; name: string }[]>([]);

  const [openDeliveries, setOpenDeliveries] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    try {
      const [res, cats, cons] = await Promise.all([
        adminListCampaigns(),
        supabase.from("categories").select("id,name").order("sort_order"),
        supabase.from("contests").select("id,title").order("created_at", { ascending: false }).limit(50),
      ]);
      setCampaigns(res.campaigns);
      setStats({ tokens: res.tokens, activeTokens: res.activeTokens, pushConfigured: res.pushConfigured });
      setCategories(cats.data ?? []);
      setContests(cons.data ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const canSubmit = useMemo(
    () =>
      title.trim().length > 0 &&
      body.trim().length > 0 &&
      (audience !== "selected" || selectedUsers.length > 0) &&
      (audience !== "category" || !!categoryId) &&
      (audience !== "contest" || !!contestId),
    [title, body, audience, selectedUsers, categoryId, contestId],
  );

  function resetForm() {
    setTitle("");
    setBody("");
    setImageUrl("");
    setDeepLink("");
    setAudience("all");
    setCategoryId("");
    setContestId("");
    setScheduledAt("");
    setSelectedUsers([]);
    setUserResults([]);
    setUserQuery("");
  }

  async function submit(mode: "now" | "schedule" | "draft") {
    if (!canSubmit) return toast.error("Add a title, message and audience");
    if (mode === "schedule" && !scheduledAt) return toast.error("Pick a date and time");
    setSaving(true);
    try {
      const res = await adminSaveCampaign({
        data: {
          title: title.trim(),
          body: body.trim(),
          image_url: imageUrl.trim() || null,
          deep_link: deepLink.trim() || null,
          audience,
          target_user_ids: audience === "selected" ? selectedUsers.map((u) => u.id) : [],
          category_id: audience === "category" ? categoryId : null,
          contest_id: audience === "contest" ? contestId : null,
          scheduled_at: mode === "schedule" ? new Date(scheduledAt).toISOString() : null,
          send_now: mode === "now",
        },
      });
      if (mode === "now") {
        toast.success(
          res.pushConfigured
            ? `Sent to ${res.sent} device(s) · ${res.recipients} user(s)`
            : `Saved for ${res.recipients} user(s). Device push activates once Firebase keys are added.`,
        );
      } else {
        toast.success(mode === "schedule" ? "Notification scheduled" : "Draft saved");
      }
      resetForm();
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function searchUsers() {
    try {
      const res = await adminSearchUsers({ data: { q: userQuery.trim() } });
      setUserResults(res.rows);
    } catch (e: any) {
      toast.error(e?.message ?? "Search failed");
    }
  }

  async function showDeliveries(id: string) {
    if (openDeliveries === id) return setOpenDeliveries(null);
    try {
      const res = await adminCampaignDeliveries({ data: { id } });
      setDeliveries(res.rows);
      setOpenDeliveries(id);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load deliveries");
    }
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="w-6 h-6 text-primary" /> Push Notifications
            </h1>
            <p className="text-sm text-muted-foreground">
              Send instant or scheduled alerts to players on their devices.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" /> Registered devices
            </div>
            <div className="text-2xl font-bold">{stats.tokens}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Active devices
            </div>
            <div className="text-2xl font-bold">{stats.activeTokens}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Device delivery (FCM)</div>
            <div className="mt-1">
              {stats.pushConfigured ? (
                <Badge className="bg-emerald-500/15 text-emerald-600">Live</Badge>
              ) : (
                <Badge variant="secondary">Pending keys</Badge>
              )}
            </div>
          </Card>
        </div>

        {!stats.pushConfigured && (
          <Card className="p-4 border-amber-500/40 bg-amber-500/5 text-sm">
            Campaigns are saved and shown inside the app right away. Device push starts working
            automatically once the Firebase keys are added — no code changes needed.
          </Card>
        )}

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold">New notification</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New contest is live!" maxLength={120} />
            </div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>
          <div>
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000} placeholder="Join the ₹10,000 Cricket Quiz now." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Link on tap (optional)</Label>
              <Input value={deepLink} onChange={(e) => setDeepLink(e.target.value)} placeholder="/contests or https://…" />
            </div>
            <div>
              <Label>Audience</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={audience}
                onChange={(e) => setAudience(e.target.value as Audience)}
              >
                {AUDIENCES.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>

          {audience === "category" && (
            <div>
              <Label>Category</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {audience === "contest" && (
            <div>
              <Label>Contest</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={contestId}
                onChange={(e) => setContestId(e.target.value)}
              >
                <option value="">Select contest…</option>
                {contests.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          )}

          {audience === "selected" && (
            <div className="space-y-2">
              <Label>Find users</Label>
              <div className="flex gap-2">
                <Input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Name, username or phone"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchUsers())}
                />
                <Button type="button" variant="outline" onClick={searchUsers}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              {userResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border divide-y">
                  {userResults.map((u) => {
                    const name = u.full_name || u.username || u.phone || "User";
                    const added = selectedUsers.some((s) => s.id === u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted"
                        onClick={() =>
                          setSelectedUsers((prev) => (added ? prev : [...prev, { id: u.id, name }]))
                        }
                      >
                        <span>{name}</span>
                        <span className="text-xs text-muted-foreground">{added ? "Added" : "Add"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedUsers.map((u) => (
                    <Badge
                      key={u.id}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => setSelectedUsers((prev) => prev.filter((s) => s.id !== u.id))}
                    >
                      {u.name} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>Schedule for later (optional)</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={saving || !canSubmit} onClick={() => submit("now")}>
              <Send className="w-4 h-4 mr-1" /> Send now
            </Button>
            <Button variant="outline" disabled={saving || !canSubmit} onClick={() => submit("schedule")}>
              <Clock className="w-4 h-4 mr-1" /> Schedule
            </Button>
            <Button variant="ghost" disabled={saving || !canSubmit} onClick={() => submit("draft")}>
              Save draft
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Campaign history</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{c.title}</span>
                        <Badge variant={c.status === "sent" ? "default" : "secondary"} className="text-[10px]">
                          {c.status}
                        </Badge>
                        {c.event_code && (
                          <Badge variant="outline" className="text-[10px]">auto · {c.event_code}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{c.body}</p>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {c.audience} · {c.recipients_count ?? 0} users · {c.sent_count ?? 0} sent
                        {c.failed_count ? ` · ${c.failed_count} failed` : ""}
                        {c.scheduled_at ? ` · for ${new Date(c.scheduled_at).toLocaleString()}` : ""}
                      </div>
                      {c.last_error && (
                        <div className="mt-1 text-xs text-destructive line-clamp-1">{c.last_error}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => showDeliveries(c.id)}>
                        Deliveries
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            const r = await adminSendCampaign({ data: { id: c.id } });
                            toast.success(`Processed ${r.recipients} user(s), ${r.sent} device push`);
                            await load();
                          } catch (e: any) {
                            toast.error(e?.message ?? "Send failed");
                          }
                        }}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (!confirm("Delete this notification?")) return;
                          try {
                            await adminDeleteCampaign({ data: { id: c.id } });
                            await load();
                          } catch (e: any) {
                            toast.error(e?.message ?? "Delete failed");
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {openDeliveries === c.id && (
                    <div className="mt-3 max-h-56 overflow-y-auto rounded-md border divide-y text-xs">
                      {deliveries.length === 0 ? (
                        <div className="p-2 text-muted-foreground">No delivery records.</div>
                      ) : (
                        deliveries.map((d) => (
                          <div key={d.id} className="flex items-center justify-between px-2 py-1.5">
                            <span>{d.name}</span>
                            <span className="text-muted-foreground">{d.status}{d.error ? ` · ${d.error}` : ""}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
