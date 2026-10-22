import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/community/shared";
import { useAuthSession } from "@/hooks/use-auth-session";
import { blockAction, getMySettings, listBlocked, saveMySettings } from "@/lib/community.functions";

export const Route = createFileRoute("/community_/settings")({
  head: () => ({ meta: [{ title: "Community settings — Guru-G" }] }),
  component: Page,
});

import type { BlockedUser } from "@/lib/community-types";
type Settings = Awaited<ReturnType<typeof getMySettings>>;
type Blocked = BlockedUser[];
const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12);

function Row({ id, title, desc, checked, onChange }: { id: string; title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div><Label htmlFor={id} className="text-sm font-bold">{title}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Page() {
  const { user, loading } = useAuthSession();
  const [s, setS] = useState<Settings | null>(null);
  const [interests, setInterests] = useState(""), [exams, setExams] = useState("");
  const [blocked, setBlocked] = useState<Blocked>([]);
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getMySettings().then((r) => { setS(r); setInterests(r.interests.join(", ")); setExams(r.examInterests.join(", ")); }).catch((e) => setError(e instanceof Error ? e.message : "Could not load settings"));
    listBlocked().then(setBlocked).catch(() => undefined);
  }, [user]);

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      await saveMySettings({ data: { isPrivate: s.isPrivate, allowComments: s.allowComments, notifySocial: s.notifySocial, notifyMessages: s.notifyMessages, interests: split(interests), examInterests: split(exams), educationLevel: s.educationLevel || undefined, coverPath: s.coverPath || undefined } });
      toast.success("Settings saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } finally { setSaving(false); }
  }
  async function unblock(userId: string) {
    try { await blockAction({ data: { userId, block: false } }); setBlocked((b) => b.filter((x) => x.userId !== userId)); toast.success("Unblocked"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  if (!loading && !user) return <AppShell><p className="p-6 text-center text-sm">Please <Link to="/auth" className="font-bold text-primary">sign in</Link> to manage Community settings.</p></AppShell>;
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <Link to="/community" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Community</Link>
        <h1 className="text-2xl font-black">Community settings</h1>
        {error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {!s && !error && <div className="mt-6 flex justify-center"><Loader2 className="animate-spin" /></div>}
        {s && (
          <div className="mt-4 space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="priv">
              <h2 id="priv" className="font-black">Privacy</h2>
              <div className="divide-y divide-border">
                <Row id="priv-acc" title="Private account" desc="Only approved followers can see your posts. New followers must send a request." checked={s.isPrivate} onChange={(isPrivate) => setS({ ...s, isPrivate })} />
                <Row id="allow-c" title="Allow comments on my posts" desc="Turn off to stop new comments on everything you post." checked={s.allowComments} onChange={(allowComments) => setS({ ...s, allowComments })} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Messaging: you can chat with people you follow and who follow you back (accepted follows on private accounts). Blocking someone always stops messages.</p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="notif">
              <h2 id="notif" className="font-black">Notifications</h2>
              <div className="divide-y divide-border">
                <Row id="n-social" title="Likes, comments, follows" desc="Community activity on your account." checked={s.notifySocial} onChange={(notifySocial) => setS({ ...s, notifySocial })} />
                <Row id="n-msg" title="Messages" desc="New direct messages." checked={s.notifyMessages} onChange={(notifyMessages) => setS({ ...s, notifyMessages })} />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="learn">
              <h2 id="learn" className="font-black">Learning interests</h2>
              <p className="text-xs text-muted-foreground">Used to personalise your For you feed. Optional.</p>
              <div className="mt-3 space-y-3">
                <div><Label htmlFor="int">Subjects (comma separated)</Label><Input id="int" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Physics, Mathematics" /></div>
                <div><Label htmlFor="ex">Exams (comma separated)</Label><Input id="ex" value={exams} onChange={(e) => setExams(e.target.value)} placeholder="JEE, NEET, SSC CGL" /></div>
                <div><Label htmlFor="lvl">Education level</Label><Input id="lvl" value={s.educationLevel} onChange={(e) => setS({ ...s, educationLevel: e.target.value })} placeholder="Class 12 / B.Tech" maxLength={60} /></div>
              </div>
            </section>

            <Button onClick={() => void save()} disabled={saving} className="w-full sm:w-auto">{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save settings</Button>

            <section className="rounded-2xl border border-border bg-card p-4" aria-labelledby="blk">
              <h2 id="blk" className="flex items-center gap-2 font-black"><ShieldOff className="h-4 w-4" />Blocked accounts</h2>
              {blocked.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">You haven't blocked anyone.</p> : (
                <ul className="mt-2 divide-y divide-border">
                  {blocked.map((b) => (
                    <li key={b.userId} className="flex items-center gap-3 py-2"><UserAvatar author={b.author} size={32} /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.author.name}</span>
                      <Button size="sm" variant="outline" onClick={() => void unblock(b.userId)}>Unblock</Button></li>
                  ))}
                </ul>)}
            </section>
            <p className="text-xs text-muted-foreground">Profile photo, name and bio are edited on <Link to="/profile" className="font-bold text-primary">your profile</Link>.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
