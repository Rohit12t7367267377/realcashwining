import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, FileText, Flag, GraduationCap, Heart, Link2, Loader2, MessageCircle, MoreHorizontal, Pencil, ShieldCheck, ShieldAlert, Trash2, Trophy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { addComment, deleteComment, deletePost, editComment, editPost, listComments, recordWatch, reportContent, toggleLike, toggleSave, type listFeed } from "@/lib/community.functions";
import { learnLinkFor } from "@/lib/community-policy";
import { CATEGORY_LABEL, Stars, UserAvatar, UserLink, timeAgo, type Author } from "./shared";

export type FeedItem = Awaited<ReturnType<typeof listFeed>>["items"][number];
const err = (e: unknown, fb: string) => toast.error(e instanceof Error ? e.message : fb);

/** Native video with accessible controls (play, seek, volume, fullscreen). Watch time is reported as cumulative
 *  playing seconds; the server caps it by real elapsed time, so a tampered client cannot inflate it. */
function VideoPlayer({ postId, src, mine }: { postId: string; src: string; mine: boolean }) {
  const played = useRef(0), last = useRef<number | null>(null), sent = useRef(0);
  const flush = () => { if (mine) return; const s = Math.floor(played.current); if (s > sent.current) { sent.current = s; void recordWatch({ data: { postId, seconds: s } }).catch(() => undefined); } };
  useEffect(() => { const t = setInterval(flush, 10_000); return () => { clearInterval(t); flush(); }; }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <video className="max-h-[70vh] w-full rounded-xl bg-black" controls playsInline preload="metadata" src={src} aria-label="Educational video"
      onPlaying={(e) => { last.current = e.currentTarget.currentTime; }}
      onTimeUpdate={(e) => { const t = e.currentTarget.currentTime; if (last.current != null && t > last.current && t - last.current < 1.5) played.current += t - last.current; last.current = t; }}
      onPause={() => { last.current = null; flush(); }} onEnded={() => { last.current = null; flush(); }} />
  );
}

function ReportDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: { type: "post" | "comment" | "account" | "rating"; id: string; creatorId?: string } }) {
  const [reason, setReason] = useState("spam"), [details, setDetails] = useState(""), [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try { await reportContent({ data: { targetType: target.type, targetId: target.id, reason: reason as never, details: details || undefined, creatorId: target.creatorId } }); toast.success("Thanks — our moderators will review this."); onClose(); setDetails(""); }
    catch (e) { err(e, "Could not report"); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Report {target.type}</DialogTitle><DialogDescription>Reports are reviewed by moderators. Content is not removed automatically.</DialogDescription></DialogHeader>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger aria-label="Reason"><SelectValue /></SelectTrigger>
          <SelectContent>{[["spam", "Spam or duplicate"], ["misinformation", "Misleading or wrong information"], ["abuse", "Abuse or harassment"], ["inappropriate", "Inappropriate content"], ["scam", "Scam or fraud"], ["copyright", "Copyright"], ["off_topic", "Not educational"], ["other", "Something else"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Textarea aria-label="Details (optional)" placeholder="Details (optional)" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
        <Button onClick={() => void send()} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Submit report</Button>
      </DialogContent>
    </Dialog>
  );
}
export { ReportDialog };

type Comment = { id: string; userId: string; body: string; createdAt: string; edited: boolean; mine: boolean; author: Author; replies?: Comment[] };

function Comments({ postId, onCount, canComment }: { postId: string; onCount: (d: number) => void; canComment: boolean }) {
  const [items, setItems] = useState<Comment[] | null>(null), [text, setText] = useState(""), [replyTo, setReplyTo] = useState<Comment | null>(null), [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null), [editText, setEditText] = useState(""), [report, setReport] = useState<string | null>(null);
  const load = async () => { try { setItems((await listComments({ data: { postId } })).comments as Comment[]); } catch (e) { err(e, "Could not load comments"); setItems([]); } };
  useEffect(() => { void load(); }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function send() {
    if (!text.trim()) return; setBusy(true);
    try { await addComment({ data: { postId, body: text, parentId: replyTo?.id } }); setText(""); setReplyTo(null); onCount(1); await load(); } catch (e) { err(e, "Could not comment"); } finally { setBusy(false); }
  }
  const row = (c: Comment, reply = false) => (
    <li key={c.id} className={cn("flex gap-2", reply && "ml-9")}>
      <UserAvatar author={c.author} size={reply ? 24 : 30} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-muted/60 px-3 py-2">
          <Link to="/u/$id" params={{ id: c.userId }} className="text-xs font-bold hover:underline">{c.author.name}</Link>
          {editing === c.id ? (
            <div className="mt-1 flex gap-2"><Input value={editText} maxLength={1000} onChange={(e) => setEditText(e.target.value)} aria-label="Edit comment" />
              <Button size="sm" onClick={async () => { try { await editComment({ data: { id: c.id, body: editText } }); setEditing(null); await load(); } catch (e) { err(e, "Could not edit"); } }}>Save</Button></div>
          ) : <p className="whitespace-pre-wrap break-words text-sm">{c.body}</p>}
        </div>
        <div className="mt-0.5 flex items-center gap-3 px-2 text-[11px] text-muted-foreground">
          <span>{timeAgo(c.createdAt)}{c.edited && " · edited"}</span>
          {!reply && canComment && <button className="font-semibold hover:text-foreground" onClick={() => setReplyTo(c)}>Reply</button>}
          {c.mine ? (<>
            <button className="hover:text-foreground" onClick={() => { setEditing(c.id); setEditText(c.body); }}>Edit</button>
            <button className="hover:text-destructive" onClick={async () => { try { await deleteComment({ data: { id: c.id } }); onCount(-1 - (c.replies?.length ?? 0)); await load(); } catch (e) { err(e, "Could not delete"); } }}>Delete</button>
          </>) : <button className="hover:text-foreground" onClick={() => setReport(c.id)}>Report</button>}
        </div>
        {c.replies?.length ? <ul className="mt-2 space-y-2">{c.replies.map((r) => row(r, true))}</ul> : null}
      </div>
    </li>
  );
  return (
    <div className="mt-3 border-t border-border pt-3">
      {items === null ? <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /> : items.length === 0 ? <p className="py-2 text-center text-xs text-muted-foreground">No comments yet. Start the discussion.</p> : <ul className="space-y-3">{items.map((c) => row(c))}</ul>}
      {canComment ? (
        <div className="mt-3">
          {replyTo && <div className="mb-1 flex items-center justify-between rounded-lg bg-primary/5 px-2 py-1 text-[11px]">Replying to {replyTo.author.name}<button className="font-bold" onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button></div>}
          <div className="flex gap-2"><Input aria-label="Write a comment" placeholder="Add a comment…" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void send()} />
            <Button onClick={() => void send()} disabled={busy || !text.trim()}>{busy ? <Loader2 className="animate-spin" /> : "Post"}</Button></div>
        </div>
      ) : <p className="mt-2 text-center text-xs text-muted-foreground">Comments are turned off for this creator.</p>}
      {report && <ReportDialog open onClose={() => setReport(null)} target={{ type: "comment", id: report }} />}
    </div>
  );
}

export function PostCard({ post, onChanged, onRemoved }: { post: FeedItem; onChanged?: (id: string, patch: Partial<FeedItem>) => void; onRemoved?: (id: string) => void }) {
  const [openComments, setOpenComments] = useState(false), [report, setReport] = useState(false), [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ title: post.title ?? "", body: post.body, subject: post.subject ?? "", examTag: post.examTag ?? "", educationLevel: post.educationLevel ?? "" });
  const [busy, setBusy] = useState(false), [expanded, setExpanded] = useState(false);
  const patch = (p: Partial<FeedItem>) => onChanged?.(post.id, p);
  const learn = learnLinkFor({ category: post.category, subject: post.subject, examTag: post.examTag, educationLevel: post.educationLevel });
  const long = post.body.length > 320;

  async function like() { patch({ liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) }); try { const r = await toggleLike({ data: { postId: post.id } }); patch({ liked: r.liked, likes: r.likes }); } catch (e) { patch({ liked: post.liked, likes: post.likes }); err(e, "Could not like"); } }
  async function save() { patch({ saved: !post.saved }); try { const r = await toggleSave({ data: { postId: post.id } }); patch({ saved: r.saved }); toast.success(r.saved ? "Saved to your collection" : "Removed from saved"); } catch (e) { patch({ saved: post.saved }); err(e, "Could not save"); } }
  async function copyLink() { try { await navigator.clipboard.writeText(`${window.location.origin}/community?post=${post.id}`); toast.success("Link copied"); } catch { toast.error("Could not copy the link"); } }
  async function share() { const url = `${window.location.origin}/community?post=${post.id}`; if (navigator.share) { try { await navigator.share({ title: post.title ?? "Guru-G Community", url }); } catch { /* cancelled */ } } else void copyLink(); }
  async function remove() { if (!confirm("Delete this post permanently?")) return; try { await deletePost({ data: { id: post.id } }); onRemoved?.(post.id); toast.success("Post deleted"); } catch (e) { err(e, "Could not delete"); } }
  async function saveEdit() {
    setBusy(true);
    try { await editPost({ data: { id: post.id, body: edit.body, title: edit.title || undefined, subject: edit.subject || undefined, examTag: edit.examTag || undefined, educationLevel: edit.educationLevel || undefined } });
      patch({ body: edit.body, title: edit.title || null, subject: edit.subject || null, examTag: edit.examTag || null, educationLevel: edit.educationLevel || null, edited: true }); setEditing(false); toast.success("Post updated"); }
    catch (e) { err(e, "Could not update"); } finally { setBusy(false); }
  }

  return (
    <article id={`post-${post.id}`} className="rounded-2xl border border-border bg-card p-4 shadow-soft" aria-label={`Post by ${post.author.name}`}>
      <header className="flex items-start justify-between gap-2">
        <UserLink id={post.userId} author={post.author} sub={`${timeAgo(post.createdAt)}${post.edited ? " · edited" : ""}`} />
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{CATEGORY_LABEL[post.category] ?? "Post"}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Post options"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void copyLink()}><Link2 className="mr-2 h-4 w-4" />Copy link</DropdownMenuItem>
              {post.mine ? (<>
                <DropdownMenuItem onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void remove()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
              </>) : <DropdownMenuItem onClick={() => setReport(true)}><Flag className="mr-2 h-4 w-4" />Report</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {editing ? (
        <div className="mt-3 space-y-2">
          <Input aria-label="Title" placeholder="Title" maxLength={140} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
          <Textarea aria-label="Post text" rows={5} maxLength={5000} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <Input aria-label="Subject" placeholder="Subject" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} />
            <Input aria-label="Exam" placeholder="Exam" value={edit.examTag} onChange={(e) => setEdit({ ...edit, examTag: e.target.value })} />
            <Input aria-label="Level" placeholder="Class / level" value={edit.educationLevel} onChange={(e) => setEdit({ ...edit, educationLevel: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button><Button onClick={() => void saveEdit()} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Save</Button></div>
        </div>
      ) : (
        <div className="mt-3">
          {post.title && <h3 className="text-base font-extrabold leading-snug">{post.title}</h3>}
          {post.body && <p className={cn("mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed", !expanded && long && "line-clamp-6")}>{post.body}</p>}
          {long && <button className="mt-1 text-xs font-bold text-primary" onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : "Read more"}</button>}
          {(post.subject || post.examTag || post.educationLevel) && (
            <div className="mt-2 flex flex-wrap gap-1.5">{[post.subject, post.examTag, post.educationLevel].filter(Boolean).map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{t}</span>)}</div>
          )}
        </div>
      )}

      {post.category === "news" && (
        <div className={cn("mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs", post.newsStatus === "verified" ? "border-success/40 bg-success/10" : post.newsStatus === "disputed" ? "border-destructive/40 bg-destructive/10" : "border-border bg-muted/50")}>
          {post.newsStatus === "verified" ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <div className="font-bold">{post.newsStatus === "verified" ? "Verified by moderators" : post.newsStatus === "disputed" ? "Disputed — under review" : "Unverified — submitted by a member"}</div>
            {post.sourceUrl && <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 truncate text-primary hover:underline"><ExternalLink className="h-3 w-3 shrink-0" /><span className="truncate">{new URL(post.sourceUrl).hostname}</span></a>}
            {post.sourcePublishedOn && <span className="ml-2 text-muted-foreground">Published {post.sourcePublishedOn}</span>}
          </div>
        </div>
      )}

      {post.mediaUrl && post.mediaType === "image" && <img src={post.mediaUrl} alt={post.title ?? "Shared image"} loading="lazy" className="mt-3 max-h-[70vh] w-full rounded-xl object-contain bg-muted" />}
      {post.mediaUrl && post.mediaType === "video" && <div className="mt-3"><VideoPlayer postId={post.id} src={post.mediaUrl} mine={post.mine} /></div>}
      {post.mediaUrl && post.mediaType === "document" && (
        <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 hover:bg-muted"><FileText className="h-8 w-8 text-primary" /><span className="text-sm font-bold">Open document (PDF)</span></a>
      )}

      {(post.quizContestId || learn) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {post.quizContestId && <Button asChild size="sm" variant="secondary"><Link to="/contest/$id" params={{ id: post.quizContestId }}><Trophy className="mr-1 h-4 w-4" />Play this quiz</Link></Button>}
          {learn && <Button asChild size="sm" variant="outline"><Link to={learn.to}><GraduationCap className="mr-1 h-4 w-4" />{learn.label}</Link></Button>}
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between border-t border-border pt-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => void like()} aria-pressed={post.liked} aria-label={post.liked ? "Unlike" : "Like"} className={cn(post.liked && "text-destructive")}><Heart className={cn("mr-1 h-4 w-4", post.liked && "fill-current")} />{post.likes}</Button>
          <Button variant="ghost" size="sm" onClick={() => setOpenComments(!openComments)} aria-expanded={openComments} aria-label="Comments"><MessageCircle className="mr-1 h-4 w-4" />{post.comments}</Button>
          <Button variant="ghost" size="sm" onClick={() => void share()} aria-label="Share"><Link2 className="mr-1 h-4 w-4" />Share</Button>
        </div>
        <div className="flex items-center gap-2">
          {post.mediaType === "video" && <span className="text-[11px] text-muted-foreground">{post.views} views</span>}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void save()} aria-pressed={post.saved} aria-label={post.saved ? "Remove from saved" : "Save"}>{post.saved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}</Button>
        </div>
      </footer>
      {openComments && <Comments postId={post.id} canComment onCount={(d) => patch({ comments: Math.max(0, post.comments + d) })} />}
      <ReportDialog open={report} onClose={() => setReport(false)} target={{ type: "post", id: post.id }} />
    </article>
  );
}
export { Stars };
