import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BarChart3, Camera, Pencil, Settings, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getCommunityProfile } from "@/lib/community.functions";
import { Stars, UserAvatar } from "@/components/community/shared";

type Me = NonNullable<Awaited<ReturnType<typeof getCommunityProfile>>>;

/** "My profile" inside Community: identity, counts, rating, edit profile and photo, plus shortcuts. Own posts render below it. */
export function MyProfileCard({ userId, onPost }: { userId: string; onPost: () => void }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", username: "", bio: "" });
  const [saving, setSaving] = useState(false), [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const load = useCallback(() => getCommunityProfile({ data: { userId } }).then((p) => setMe(p as Me | null)).catch(() => setMe(null)), [userId]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      const username = form.username.trim().toLowerCase().replace(/\s+/g, "_");
      const { error } = await supabase.from("profiles").update({ full_name: form.full_name.trim() || null, username: username || null, bio: form.bio.trim() || null }).eq("id", userId);
      if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "That username is taken" : error.message);
      toast.success("Profile saved"); setOpen(false); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } finally { setSaving(false); }
  }
  async function photo(f: File) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast.error("Use a JPG, PNG or WebP photo");
    if (f.size > 8 * 1024 * 1024) return toast.error("Photo must be under 8 MB");
    setUploading(true);
    try {
      const path = `${userId}/avatar-${crypto.randomUUID()}.${f.type.split("/")[1]}`;
      const up = await supabase.storage.from("community").upload(path, f, { contentType: f.type });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", userId);
      if (error) throw new Error(error.message);
      toast.success("Photo updated"); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); } finally { setUploading(false); if (file.current) file.current.value = ""; }
  }

  if (me === undefined) return <Skeleton className="mt-3 h-40 rounded-2xl" />;
  if (!me) return <div className="mt-3 rounded-2xl border border-border bg-card p-4 text-sm">Could not load your profile. <button className="font-bold underline" onClick={() => void load()}>Retry</button></div>;
  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-border bg-card" aria-label="My profile">
      <div className="h-20 bg-gradient-hero sm:h-28" style={me.cover ? { backgroundImage: `url(${me.cover})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} role="img" aria-label="Profile banner" />
      <div className="px-4 pb-4">
        <div className="-mt-9 flex items-end justify-between gap-3">
          <div className="relative">
            <UserAvatar author={{ name: me.name, username: me.username, avatar: me.avatar }} size={72} className="ring-4 ring-card" />
            <button type="button" aria-label="Change profile photo" disabled={uploading} onClick={() => file.current?.click()} className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"><Camera className="h-3.5 w-3.5" /></button>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-hidden tabIndex={-1} onChange={(e) => e.target.files?.[0] && void photo(e.target.files[0])} />
          </div>
          <Button size="sm" variant="outline" onClick={() => { setForm({ full_name: me.name === me.username ? "" : me.name, username: me.username ?? "", bio: me.bio ?? "" }); setOpen(true); }}><Pencil className="mr-1 h-4 w-4" />Edit profile</Button>
        </div>
        <h2 className="mt-2 text-lg font-black leading-tight">{me.name}</h2>
        <p className="text-xs text-muted-foreground">{me.username ? `@${me.username}` : "Add a username in Edit profile"}{me.isPrivate ? " · Private account" : ""}</p>
        {me.bio && <p className="mt-1 whitespace-pre-wrap text-sm">{me.bio}</p>}
        <dl className="mt-3 grid grid-cols-3 gap-1 text-center">
          {([["Posts", me.posts], ["Followers", me.followers], ["Following", me.following]] as const).map(([k, v]) => <div key={k}><dd className="text-base font-black">{v}</dd><dt className="text-[11px] text-muted-foreground">{k}</dt></div>)}
        </dl>
        {me.rating.count > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs"><Stars value={me.rating.avg} /> <b>{me.rating.avg.toFixed(1)}</b><span className="text-muted-foreground">from {me.rating.count} rating{me.rating.count === 1 ? "" : "s"}</span></p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={onPost}><Pencil className="mr-1 h-4 w-4" />Create a post</Button>
          <Button asChild size="sm" variant="outline"><Link to="/community/studio"><BarChart3 className="mr-1 h-4 w-4" />Studio</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/community/settings"><Settings className="mr-1 h-4 w-4" />Privacy</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/profile"><Wallet className="mr-1 h-4 w-4" />Wallet &amp; account</Link></Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="mp-name">Name</Label><Input id="mp-name" value={form.full_name} maxLength={80} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label htmlFor="mp-user">Username</Label><Input id="mp-user" value={form.username} maxLength={30} placeholder="quiz_king" onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><Label htmlFor="mp-bio">Bio</Label><Textarea id="mp-bio" rows={3} value={form.bio} maxLength={200} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
            <Button className="w-full" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
