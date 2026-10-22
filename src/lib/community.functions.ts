// Community server functions. Reads run as the signed-in user (database RLS decides visibility: private accounts,
// blocks, hidden posts). Writes that need content policy / rate limits go through here with service-role inserts
// AFTER validation; direct client writes to posts, comments and watch time are revoked in the database.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdminPermission } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkContent, commentInputSchema, normaliseForDuplicate, postInputSchema, rankFeed, RATE_LIMITS, type RankInput } from "@/lib/community-policy";

/* eslint-disable @typescript-eslint/no-explicit-any */
const U = (c: { supabase: unknown }) => c.supabase as any;
const A = supabaseAdmin as any;
const PAGE = 15;
const uuid = z.string().uuid();
const clean = (s: string) => s.replace(/[,()%*\\]/g, " ").trim().slice(0, 80);
const POST_COLS = "id,user_id,body,title,category,subject,exam_tag,education_level,source_url,source_published_on,news_status,quiz_contest_id,media_url,media_type,duration_seconds,like_count,comment_count,hidden,created_at,edited_at";

async function signMedia(paths: string[]) {
  const m: Record<string, string> = {};
  const uniq = [...new Set(paths.filter(Boolean))];
  if (!uniq.length) return m;
  const { data } = await A.storage.from("community").createSignedUrls(uniq, 3600);
  for (const u of data ?? []) if (u.path && u.signedUrl) m[u.path] = u.signedUrl;
  return m;
}
async function authorsOf(ids: string[]) {
  const map: Record<string, { name: string; username: string | null; avatar: string | null }> = {};
  const uniq = [...new Set(ids)];
  if (!uniq.length) return map;
  const { data: profs } = await A.from("profiles").select("id,full_name,username,avatar_url").in("id", uniq);
  const av = await signMedia((profs ?? []).map((p: any) => p.avatar_url).filter((x: string | null) => x && !/^https?:/.test(x)));
  for (const p of profs ?? []) map[p.id] = { name: p.full_name || p.username || "Learner", username: p.username, avatar: p.avatar_url ? (av[p.avatar_url] ?? (/^https?:/.test(p.avatar_url) ? p.avatar_url : null)) : null };
  return map;
}

// ------------------------------------------------------------------ feed
const feedInput = z.object({
  mode: z.enum(["for_you", "following", "explore", "trending", "saved", "user"]).default("for_you"),
  category: z.string().max(20).optional(), subject: z.string().max(60).optional(), exam: z.string().max(60).optional(),
  level: z.string().max(60).optional(), q: z.string().max(80).optional(), userId: uuid.optional(), id: uuid.optional(),
  cursor: z.string().max(40).optional(), page: z.number().int().min(0).max(50).default(0),
});

export const listFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => feedInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = U(context), me = context.userId;
    const [{ data: myFollows }, { data: mySettings }] = await Promise.all([
      sb.from("follows").select("following_id").eq("follower_id", me).eq("status", "accepted"),
      sb.from("community_profile_settings").select("interests,exam_interests").eq("user_id", me).maybeSingle(),
    ]);
    const following = new Set<string>((myFollows ?? []).map((r: any) => r.following_id));
    const ranked = data.mode === "for_you" || data.mode === "trending";

    let q = sb.from("community_posts").select(POST_COLS).eq("hidden", false);
    if (data.category && data.category !== "all") q = q.eq("category", data.category);
    if (data.subject) q = q.ilike("subject", clean(data.subject));
    if (data.exam) q = q.ilike("exam_tag", clean(data.exam));
    if (data.level) q = q.ilike("education_level", clean(data.level));
    if (data.q && clean(data.q).length >= 2) { const t = clean(data.q); q = q.or(`title.ilike.%${t}%,body.ilike.%${t}%,subject.ilike.%${t}%,exam_tag.ilike.%${t}%`); }
    if (data.id) q = q.eq("id", data.id);
    if (data.mode === "following") { if (!following.size) return { items: [], hasMore: false, nextCursor: null, nextPage: 0 }; q = q.in("user_id", [...following]); }
    if (data.mode === "user") q = q.eq("user_id", data.userId ?? me);
    if (data.mode === "saved") {
      const { data: s } = await sb.from("post_saves").select("post_id").eq("user_id", me).order("created_at", { ascending: false }).limit(200);
      const ids = (s ?? []).map((r: any) => r.post_id);
      if (!ids.length) return { items: [], hasMore: false, nextCursor: null, nextPage: 0 };
      q = q.in("id", ids);
    }
    if (data.mode === "trending") q = q.gte("created_at", new Date(Date.now() - 14 * 86_400_000).toISOString());
    q = q.order("created_at", { ascending: false });
    if (ranked) q = q.limit(160); else { if (data.cursor) q = q.lt("created_at", data.cursor); q = q.limit(PAGE + 1); }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let list: any[] = rows ?? [];

    const ids = list.map((p) => p.id);
    const [{ data: stats }, { data: likes }, { data: saves }] = await Promise.all([
      ids.length ? sb.rpc("community_post_stats", { _ids: ids }) : { data: [] },
      ids.length ? sb.from("post_likes").select("post_id").eq("user_id", me).in("post_id", ids) : { data: [] },
      ids.length ? sb.from("post_saves").select("post_id").eq("user_id", me).in("post_id", ids) : { data: [] },
    ]);
    const st = new Map<string, any>((stats ?? []).map((s: any) => [s.post_id, s]));
    const likedSet = new Set((likes ?? []).map((r: any) => r.post_id)), savedSet = new Set((saves ?? []).map((r: any) => r.post_id));

    let hasMore = false, nextCursor: string | null = null, nextPage = data.page;
    if (ranked) {
      const prefs = { subjects: mySettings?.interests ?? [], exams: mySettings?.exam_interests ?? [] };
      const inputs: (RankInput & { row: any })[] = list.map((p) => ({
        id: p.id, userId: p.user_id, createdAt: new Date(p.created_at).getTime(), category: p.category, subject: p.subject, examTag: p.exam_tag,
        likes: p.like_count, comments: p.comment_count, saves: Number(st.get(p.id)?.saves ?? 0), validViews: Number(st.get(p.id)?.valid_views ?? 0),
        avgPct: Number(st.get(p.id)?.avg_pct ?? 0), followsAuthor: following.has(p.user_id), newsStatus: p.news_status, row: p,
      }));
      const order = rankFeed(inputs, prefs, data.mode === "trending" ? "trending" : "for_you");
      list = order.slice(data.page * PAGE, data.page * PAGE + PAGE).map((o) => o.row);
      hasMore = order.length > (data.page + 1) * PAGE; nextPage = data.page + 1;
    } else {
      hasMore = list.length > PAGE; list = list.slice(0, PAGE); nextCursor = hasMore ? list[list.length - 1].created_at : null;
    }

    const [authors, media] = await Promise.all([authorsOf(list.map((p) => p.user_id)), signMedia(list.map((p) => p.media_url))]);
    return {
      hasMore, nextCursor, nextPage,
      items: list.map((p) => ({
        id: p.id, userId: p.user_id, author: authors[p.user_id] ?? { name: "Learner", username: null, avatar: null }, mine: p.user_id === me,
        category: p.category as string, title: p.title as string | null, body: p.body as string, subject: p.subject as string | null, examTag: p.exam_tag as string | null,
        educationLevel: p.education_level as string | null, sourceUrl: p.source_url as string | null, sourcePublishedOn: p.source_published_on as string | null,
        newsStatus: p.news_status as string, quizContestId: p.quiz_contest_id as string | null,
        mediaUrl: p.media_url ? (media[p.media_url] ?? null) : null, mediaType: p.media_type as string | null, durationSeconds: p.duration_seconds as number | null,
        likes: p.like_count as number, comments: p.comment_count as number, saves: Number(st.get(p.id)?.saves ?? 0), views: Number(st.get(p.id)?.valid_views ?? 0),
        liked: likedSet.has(p.id), saved: savedSet.has(p.id), followsAuthor: following.has(p.user_id), createdAt: p.created_at as string, edited: !!p.edited_at,
      })),
    };
  });

// ------------------------------------------------------------------ posts
async function assertRate(table: string, col: string, userId: string, since: string, max: number, msg: string, extra?: (q: any) => any) {
  let q = A.from(table).select("id", { count: "exact", head: true }).eq(col, userId).gte("created_at", since);
  if (extra) q = extra(q);
  const { count } = await q;
  if ((count ?? 0) >= max) throw new Error(msg);
}

export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => postInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const me = context.userId;
    const text = `${data.title ?? ""}\n${data.body}`;
    const policy = checkContent(text);
    if (!policy.ok) throw new Error(policy.reason);
    if (data.media && !data.media.path.startsWith(`${me}/`)) throw new Error("Invalid media path");
    await assertRate("community_posts", "user_id", me, new Date(Date.now() - 86_400_000).toISOString(), RATE_LIMITS.postsPerDay, "Daily post limit reached. Please try again tomorrow.");
    const norm = normaliseForDuplicate(data.body);
    if (norm.length > 20) {
      const { data: recent } = await A.from("community_posts").select("body").eq("user_id", me).gte("created_at", new Date(Date.now() - 86_400_000).toISOString()).limit(50);
      if ((recent ?? []).some((r: any) => normaliseForDuplicate(r.body) === norm)) throw new Error("You already posted this. Please avoid duplicate posts.");
    }
    if (data.quizContestId) {
      const { data: c } = await A.from("contests").select("id,entry_fee,active").eq("id", data.quizContestId).maybeSingle();
      if (!c || !c.active) throw new Error("That quiz is not available.");
      if (Number(c.entry_fee) > 0) throw new Error("Only free quizzes can be shared.");
    }
    const { data: mod } = await A.from("app_settings").select("value").eq("key", "community_moderation").maybeSingle();
    const needsApproval = mod?.value === true;
    const { data: row, error } = await A.from("community_posts").insert({
      user_id: me, body: data.body, title: data.title ?? null, category: data.category, subject: data.subject ?? null, exam_tag: data.examTag ?? null,
      education_level: data.educationLevel ?? null, source_url: data.sourceUrl ?? null, source_published_on: data.sourcePublishedOn ?? null,
      quiz_contest_id: data.quizContestId ?? null, media_url: data.media?.path ?? null, media_type: data.media?.kind ?? null,
      duration_seconds: data.media?.kind === "video" ? (data.media.durationSeconds ?? null) : null, hidden: needsApproval, news_status: "unverified",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, pendingApproval: needsApproval };
  });

export const editPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, title: z.string().trim().max(140).optional(), body: z.string().trim().max(5000), subject: z.string().trim().max(60).optional(), examTag: z.string().trim().max(60).optional(), educationLevel: z.string().trim().max(60).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await A.from("community_posts").select("id,user_id,media_url,category").eq("id", data.id).maybeSingle();
    if (!p || p.user_id !== context.userId) throw new Error("You can only edit your own posts.");
    if (!data.body && !p.media_url) throw new Error("A post needs text or a file.");
    const policy = checkContent(`${data.title ?? ""}\n${data.body}`);
    if (!policy.ok) throw new Error(policy.reason);
    const { error } = await A.from("community_posts").update({ body: data.body, title: data.title || null, subject: data.subject || null, exam_tag: data.examTag || null, education_level: data.educationLevel || null, edited_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await A.from("community_posts").select("user_id,media_url").eq("id", data.id).maybeSingle();
    if (!p || p.user_id !== context.userId) throw new Error("You can only delete your own posts.");
    const { error } = await A.from("community_posts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (p.media_url) void A.storage.from("community").remove([p.media_url]);
    return { ok: true };
  });

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ postId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = U(context);
    const { data: ex } = await sb.from("post_likes").select("post_id").eq("post_id", data.postId).eq("user_id", context.userId).maybeSingle();
    if (ex) { const { error } = await sb.from("post_likes").delete().eq("post_id", data.postId).eq("user_id", context.userId); if (error) throw new Error(error.message); }
    else { const { error } = await sb.from("post_likes").insert({ post_id: data.postId, user_id: context.userId }); if (error) throw new Error("You cannot like this post."); }
    const { data: p } = await sb.from("community_posts").select("like_count").eq("id", data.postId).maybeSingle();
    return { liked: !ex, likes: (p?.like_count ?? 0) as number };
  });

export const toggleSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ postId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = U(context);
    const { data: ex } = await sb.from("post_saves").select("post_id").eq("post_id", data.postId).eq("user_id", context.userId).maybeSingle();
    if (ex) await sb.from("post_saves").delete().eq("post_id", data.postId).eq("user_id", context.userId);
    else { const { error } = await sb.from("post_saves").insert({ post_id: data.postId, user_id: context.userId }); if (error) throw new Error("You cannot save this post."); }
    return { saved: !ex };
  });

// ------------------------------------------------------------------ comments
export const listComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ postId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = U(context);
    const { data: rows, error } = await sb.from("post_comments").select("id,user_id,body,parent_id,created_at,edited_at").eq("post_id", data.postId).eq("hidden", false).order("created_at", { ascending: true }).limit(200);
    if (error) throw new Error(error.message);
    const authors = await authorsOf((rows ?? []).map((r: any) => r.user_id));
    const all = (rows ?? []).map((r: any) => ({ id: r.id as string, userId: r.user_id as string, body: r.body as string, parentId: r.parent_id as string | null, createdAt: r.created_at as string, edited: !!r.edited_at, mine: r.user_id === context.userId, author: authors[r.user_id] ?? { name: "Learner", username: null, avatar: null } }));
    return { comments: all.filter((c: any) => !c.parentId).map((c: any) => ({ ...c, replies: all.filter((r: any) => r.parentId === c.id) })) };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => commentInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const me = context.userId, sb = U(context);
    const { data: post } = await sb.from("community_posts").select("id,user_id").eq("id", data.postId).maybeSingle(); // RLS: only visible posts
    if (!post) throw new Error("This post is not available.");
    const { data: s } = await A.from("community_profile_settings").select("allow_comments").eq("user_id", post.user_id).maybeSingle();
    if (s && s.allow_comments === false && post.user_id !== me) throw new Error("Comments are turned off for this post.");
    const policy = checkContent(data.body, { maxLinks: 1 });
    if (!policy.ok) throw new Error(policy.reason);
    await assertRate("post_comments", "user_id", me, new Date(Date.now() - 60_000).toISOString(), RATE_LIMITS.commentsPerMinute, "You are commenting too fast. Please wait a moment.");
    const { data: row, error } = await A.from("post_comments").insert({ post_id: data.postId, user_id: me, body: data.body, parent_id: data.parentId ?? null }).select("id").single();
    if (error) throw new Error(error.message.includes("Replies") ? "You can only reply to a top-level comment." : error.message);
    return { id: row.id as string };
  });

export const editComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, body: z.string().trim().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: c } = await A.from("post_comments").select("user_id").eq("id", data.id).maybeSingle();
    if (!c || c.user_id !== context.userId) throw new Error("You can only edit your own comments.");
    const policy = checkContent(data.body, { maxLinks: 1 });
    if (!policy.ok) throw new Error(policy.reason);
    const { error } = await A.from("post_comments").update({ body: data.body, edited_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await U(context).from("post_comments").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ------------------------------------------------------------------ reports
export const reportContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    targetType: z.enum(["post", "comment", "message", "account", "rating"]), targetId: uuid,
    reason: z.enum(["spam", "misinformation", "abuse", "inappropriate", "scam", "copyright", "off_topic", "other"]),
    details: z.string().trim().max(1000).optional(), creatorId: uuid.optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRate("content_reports", "reporter_id", context.userId, new Date(Date.now() - 86_400_000).toISOString(), RATE_LIMITS.reportsPerDay, "Report limit reached for today.");
    const details = data.targetType === "rating" && data.creatorId ? `creator:${data.creatorId}${data.details ? ` | ${data.details}` : ""}` : (data.details ?? null);
    const { error } = await U(context).from("content_reports").insert({ reporter_id: context.userId, target_type: data.targetType, target_id: data.targetId, reason: data.reason, details });
    if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "You have already reported this." : "Could not submit the report.");
    return { ok: true };
  });

// ------------------------------------------------------------------ profiles, follows, blocks
export const getCommunityProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = U(context);
    const { data: rows } = await sb.rpc("community_profile_summary", { _user: data.userId });
    const p = rows?.[0];
    if (!p) return null;
    const [{ data: st }, { data: rating }, { data: ms }] = await Promise.all([
      p.can_view ? sb.from("community_profile_settings").select("interests,exam_interests,education_level,cover_path").eq("user_id", data.userId).maybeSingle() : { data: null },
      sb.rpc("creator_rating_summary", { _creator: data.userId }),
      sb.rpc("creator_milestone", { _creator: data.userId }),
    ]);
    const [authors, media] = await Promise.all([authorsOf([data.userId]), signMedia([st?.cover_path].filter(Boolean))]);
    let myRating: { stars: number; comment: string | null } | null = null;
    if (data.userId !== context.userId) {
      const { data: mr } = await sb.from("creator_ratings").select("stars,comment").eq("creator_id", data.userId).eq("rater_id", context.userId).maybeSingle();
      myRating = mr ?? null;
    }
    return {
      id: p.id as string, name: (p.full_name || p.username || "Learner") as string, username: p.username as string | null, avatar: authors[data.userId]?.avatar ?? null, bio: p.bio as string | null,
      isPrivate: p.is_private as boolean, followers: p.followers as number, following: p.following as number, posts: p.posts as number,
      viewerFollows: p.viewer_follows as boolean, viewerPending: p.viewer_pending as boolean, followsViewer: p.follows_viewer as boolean, canView: p.can_view as boolean,
      viewerBlocked: p.viewer_blocked as boolean, canMessage: p.can_message as boolean, isMe: data.userId === context.userId,
      interests: (st?.interests ?? []) as string[], examInterests: (st?.exam_interests ?? []) as string[], educationLevel: (st?.education_level ?? null) as string | null,
      cover: st?.cover_path ? (media[st.cover_path] ?? null) : null,
      rating: { avg: Number(rating?.[0]?.avg_stars ?? 0), count: Number(rating?.[0]?.ratings ?? 0), dist: [1, 2, 3, 4, 5].map((n) => Number(rating?.[0]?.[`s${n}`] ?? 0)) },
      milestone: ms?.[0] ? { enabled: ms[0].enabled as boolean, followers: ms[0].followers as number, needFollowers: ms[0].need_followers as number, avg: Number(ms[0].avg_stars), needAvg: Number(ms[0].need_avg), ratings: ms[0].ratings as number, needRatings: ms[0].need_ratings as number, eligible: ms[0].eligible as boolean } : null,
      myRating,
    };
  });

export const followAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ targetId: uuid, action: z.enum(["follow", "unfollow", "accept", "reject", "remove_follower"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = U(context), me = context.userId;
    if (data.targetId === me) throw new Error("You cannot follow yourself.");
    if (data.action === "follow") {
      const { error } = await sb.from("follows").insert({ follower_id: me, following_id: data.targetId });
      if (error && !/duplicate|unique/i.test(error.message)) throw new Error(/cannot follow/i.test(error.message) ? "You cannot follow this account." : error.message);
    } else if (data.action === "unfollow") {
      await sb.from("follows").delete().eq("follower_id", me).eq("following_id", data.targetId);
    } else if (data.action === "accept") {
      const { data: r } = await sb.from("follows").update({ status: "accepted" }).eq("follower_id", data.targetId).eq("following_id", me).eq("status", "pending").select("follower_id");
      if (!r?.length) throw new Error("No pending request from this user.");
    } else {
      await sb.from("follows").delete().eq("follower_id", data.targetId).eq("following_id", me);
    }
    const { data: f } = await sb.from("follows").select("status").eq("follower_id", me).eq("following_id", data.targetId).maybeSingle();
    return { status: (f?.status ?? "none") as "none" | "pending" | "accepted" };
  });

export const listFollowRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await U(context).from("follows").select("follower_id,created_at").eq("following_id", context.userId).eq("status", "pending").order("created_at", { ascending: false }).limit(100);
    const authors = await authorsOf((data ?? []).map((r: any) => r.follower_id));
    return (data ?? []).map((r: any) => ({ userId: r.follower_id as string, createdAt: r.created_at as string, author: authors[r.follower_id] ?? { name: "Learner", username: null, avatar: null } }));
  });

export const listConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: uuid, kind: z.enum(["followers", "following"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const col = data.kind === "followers" ? "following_id" : "follower_id", other = data.kind === "followers" ? "follower_id" : "following_id";
    const { data: rows } = await U(context).from("follows").select(other).eq(col, data.userId).eq("status", "accepted").order("created_at", { ascending: false }).limit(200);
    const ids = (rows ?? []).map((r: any) => r[other]);
    const authors = await authorsOf(ids);
    return ids.map((id: string) => ({ userId: id, author: authors[id] ?? { name: "Learner", username: null, avatar: null } }));
  });

export const blockAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: uuid, block: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("You cannot block yourself.");
    const sb = U(context);
    if (data.block) { const { error } = await sb.from("user_blocks").insert({ blocker_id: context.userId, blocked_id: data.userId }); if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message); }
    else await sb.from("user_blocks").delete().eq("blocker_id", context.userId).eq("blocked_id", data.userId);
    return { blocked: data.block };
  });

export const listBlocked = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await U(context).from("user_blocks").select("blocked_id,created_at").eq("blocker_id", context.userId).order("created_at", { ascending: false }).limit(200);
    const authors = await authorsOf((data ?? []).map((r: any) => r.blocked_id));
    return (data ?? []).map((r: any) => ({ userId: r.blocked_id as string, author: authors[r.blocked_id] ?? { name: "Learner", username: null, avatar: null } }));
  });

export const searchPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await U(context).rpc("community_search_people", { _q: data.q, _limit: 20 });
    const authors = await authorsOf((rows ?? []).map((r: any) => r.id));
    return (rows ?? []).map((r: any) => ({ userId: r.id as string, name: (r.full_name || r.username || "Learner") as string, username: r.username as string | null, avatar: authors[r.id]?.avatar ?? null, bio: r.bio as string | null, isPrivate: r.is_private as boolean, followers: r.followers as number }));
  });

// ------------------------------------------------------------------ ratings, watch time, analytics
export const rateCreator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ creatorId: uuid, stars: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.comment) { const p = checkContent(data.comment, { maxLinks: 0 }); if (!p.ok) throw new Error(p.reason); }
    const { error } = await U(context).rpc("rate_creator", { _creator: data.creatorId, _stars: data.stars, _comment: data.comment ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ postId: uuid, seconds: z.number().int().min(0).max(14400) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: s, error } = await U(context).rpc("record_post_watch", { _post: data.postId, _seconds: data.seconds });
    if (error) throw new Error(error.message);
    return { seconds: Number(s ?? 0) };
  });

export const getCreatorAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ days: z.union([z.literal(7), z.literal(30)]).default(30) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = U(context), me = context.userId;
    const { data: series, error } = await sb.rpc("creator_analytics", { _creator: me, _days: data.days });
    if (error) throw new Error(error.message);
    const days = (series ?? []).map((r: any) => ({ day: r.day as string, validViews: Number(r.valid_views), watchSeconds: Number(r.watch_seconds), avgViewSeconds: Number(r.avg_view_seconds), avgPctViewed: Number(r.avg_pct_viewed), likes: Number(r.likes), comments: Number(r.comments), newFollowers: Number(r.new_followers) }));
    const sum = (k: "validViews" | "watchSeconds" | "likes" | "comments" | "newFollowers") => days.reduce((s: number, d: any) => s + d[k], 0);
    const viewDays = days.filter((d: any) => d.validViews > 0);
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: mine } = await sb.from("community_posts").select("id,title,body,category,like_count,comment_count,created_at,media_type").eq("user_id", me).eq("hidden", false).gte("created_at", since).order("created_at", { ascending: false }).limit(60);
    const ids = (mine ?? []).map((p: any) => p.id);
    const { data: stats } = ids.length ? await sb.rpc("community_post_stats", { _ids: ids }) : { data: [] };
    const sm = new Map<string, any>((stats ?? []).map((s: any) => [s.post_id, s]));
    const { data: contests } = await A.from("community_posts").select("quiz_contest_id").eq("user_id", me).not("quiz_contest_id", "is", null);
    const qIds = [...new Set((contests ?? []).map((c: any) => c.quiz_contest_id))];
    const { count: quizAttempts } = qIds.length ? await A.from("contest_attempts").select("id", { count: "exact", head: true }).in("contest_id", qIds) : { count: 0 };
    const { count: quizDone } = qIds.length ? await A.from("contest_attempts").select("id", { count: "exact", head: true }).in("contest_id", qIds).eq("status", "completed") : { count: 0 };
    return {
      rangeDays: data.days, days,
      totals: { validViews: sum("validViews"), watchHours: Math.round((sum("watchSeconds") / 3600) * 10) / 10, likes: sum("likes"), comments: sum("comments"), newFollowers: sum("newFollowers"),
        avgViewSeconds: viewDays.length ? Math.round(viewDays.reduce((s: number, d: any) => s + d.avgViewSeconds, 0) / viewDays.length) : 0,
        avgPctViewed: viewDays.length ? Math.round((viewDays.reduce((s: number, d: any) => s + d.avgPctViewed, 0) / viewDays.length) * 10) / 10 : 0,
        quizAttempts: quizAttempts ?? 0, quizCompletions: quizDone ?? 0 },
      posts: (mine ?? []).map((p: any) => ({ id: p.id as string, title: (p.title || p.body || "Post").slice(0, 70) as string, category: p.category as string, mediaType: p.media_type as string | null, likes: p.like_count as number, comments: p.comment_count as number, validViews: Number(sm.get(p.id)?.valid_views ?? 0), avgPct: Math.round(Number(sm.get(p.id)?.avg_pct ?? 0) * 100) })).sort((a: any, b: any) => b.validViews - a.validViews).slice(0, 10),
      note: "Today's figures are estimates and can still change. A view counts after 5 seconds of validated watch time; your own views and repeat views on the same day are not counted.",
      today: new Date().toISOString().slice(0, 10),
    };
  });

// ------------------------------------------------------------------ settings & notifications
const settingsSchema = z.object({
  isPrivate: z.boolean(), allowComments: z.boolean(), notifySocial: z.boolean(), notifyMessages: z.boolean(),
  interests: z.array(z.string().trim().min(1).max(40)).max(12), examInterests: z.array(z.string().trim().min(1).max(40)).max(12),
  educationLevel: z.string().trim().max(60).optional(), coverPath: z.string().max(300).optional(),
});
export const getMySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: s } = await U(context).from("community_profile_settings").select("*").eq("user_id", context.userId).maybeSingle();
    return { isPrivate: s?.is_private ?? false, allowComments: s?.allow_comments ?? true, notifySocial: s?.notify_social ?? true, notifyMessages: s?.notify_messages ?? true, interests: (s?.interests ?? []) as string[], examInterests: (s?.exam_interests ?? []) as string[], educationLevel: (s?.education_level ?? "") as string, coverPath: (s?.cover_path ?? "") as string };
  });
export const saveMySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.coverPath && !data.coverPath.startsWith(`${context.userId}/`)) throw new Error("Invalid cover path");
    const { error } = await U(context).from("community_profile_settings").upsert({
      user_id: context.userId, is_private: data.isPrivate, allow_comments: data.allowComments, notify_social: data.notifySocial, notify_messages: data.notifyMessages,
      interests: data.interests, exam_interests: data.examInterests, education_level: data.educationLevel || null, cover_path: data.coverPath || null, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSocialNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = U(context);
    const [{ data: rows }, { count }] = await Promise.all([
      sb.from("community_notifications").select("id,actor_id,kind,post_id,read_at,created_at").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(60),
      sb.from("community_notifications").select("id", { count: "exact", head: true }).eq("user_id", context.userId).is("read_at", null),
    ]);
    const authors = await authorsOf((rows ?? []).map((r: any) => r.actor_id).filter(Boolean));
    return { unread: count ?? 0, items: (rows ?? []).map((r: any) => ({ id: r.id as string, kind: r.kind as string, postId: r.post_id as string | null, actorId: r.actor_id as string | null, actor: r.actor_id ? (authors[r.actor_id] ?? null) : null, read: !!r.read_at, createdAt: r.created_at as string })) };
  });
export const markSocialRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(uuid).max(100).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = U(context).from("community_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", context.userId).is("read_at", null);
    if (data.ids?.length) q = q.in("id", data.ids);
    await q;
    return { ok: true };
  });

// ------------------------------------------------------------------ admin moderation
const mod = requireAdminPermission("community.moderate");
async function audit(actor: string, action: string, targetType: string, targetId: string | null, after: Record<string, unknown>, reason: string | null) {
  try { await A.from("admin_audit_logs").insert({ actor_id: actor, permission_key: "community.moderate", action, target_type: targetType, target_id: targetId, result: "success", reason, after_data: after, metadata: {} }); } catch { /* never block moderation */ }
}
export const adminListReports = createServerFn({ method: "POST" })
  .middleware([mod])
  .inputValidator((d) => z.object({ status: z.enum(["open", "actioned", "dismissed"]).default("open") }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows } = await A.from("content_reports").select("*").eq("status", data.status).order("created_at", { ascending: false }).limit(200);
    const reps = rows ?? [];
    const counts = new Map<string, number>();
    for (const r of reps) counts.set(`${r.target_type}:${r.target_id}`, (counts.get(`${r.target_type}:${r.target_id}`) ?? 0) + 1);
    const postIds = reps.filter((r: any) => r.target_type === "post").map((r: any) => r.target_id);
    const cIds = reps.filter((r: any) => r.target_type === "comment").map((r: any) => r.target_id);
    const [{ data: posts }, { data: comments }] = await Promise.all([
      postIds.length ? A.from("community_posts").select("id,user_id,title,body,hidden,category").in("id", postIds) : { data: [] },
      cIds.length ? A.from("post_comments").select("id,user_id,body,hidden").in("id", cIds) : { data: [] },
    ]);
    const pm = new Map<string, any>((posts ?? []).map((p: any) => [p.id, p])), cm = new Map<string, any>((comments ?? []).map((c: any) => [c.id, c]));
    const authors = await authorsOf([...reps.map((r: any) => r.reporter_id), ...(posts ?? []).map((p: any) => p.user_id), ...(comments ?? []).map((c: any) => c.user_id)]);
    return reps.map((r: any) => {
      const t = r.target_type === "post" ? pm.get(r.target_id) : r.target_type === "comment" ? cm.get(r.target_id) : null;
      return { id: r.id as string, targetType: r.target_type as string, targetId: r.target_id as string, reason: r.reason as string, details: r.details as string | null, status: r.status as string,
        createdAt: r.created_at as string, reportCount: counts.get(`${r.target_type}:${r.target_id}`) ?? 1, reporter: authors[r.reporter_id]?.name ?? "Learner",
        preview: t ? ((t.title ? `${t.title} — ` : "") + (t.body ?? "")).slice(0, 220) : null, targetHidden: t?.hidden ?? null, targetAuthorId: t?.user_id ?? null, targetAuthor: t ? (authors[t.user_id]?.name ?? "Learner") : null, resolutionNote: r.resolution_note as string | null };
    });
  });

export const adminResolveReport = createServerFn({ method: "POST" })
  .middleware([mod])
  .inputValidator((d) => z.object({ id: uuid, action: z.enum(["dismiss", "hide", "unhide"]), note: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const actor = (context as any).adminUserId as string;
    const { data: r } = await A.from("content_reports").select("*").eq("id", data.id).maybeSingle();
    if (!r) throw new Error("Report not found");
    if (data.action !== "dismiss") {
      const hidden = data.action === "hide";
      if (r.target_type === "post") await A.from("community_posts").update({ hidden }).eq("id", r.target_id);
      else if (r.target_type === "comment") await A.from("post_comments").update({ hidden }).eq("id", r.target_id);
      else if (r.target_type === "rating") {
        const creator = /creator:([0-9a-f-]{36})/.exec(r.details ?? "")?.[1];
        if (!creator) throw new Error("Rating report is missing the creator reference.");
        await A.from("creator_ratings").update({ hidden }).eq("creator_id", creator).eq("rater_id", r.target_id);
      }
    }
    await A.from("content_reports").update({ status: data.action === "dismiss" ? "dismissed" : "actioned", resolved_by: actor, resolved_at: new Date().toISOString(), resolution_note: data.note }).eq("id", data.id);
    await audit(actor, `report.${data.action}`, r.target_type, r.target_id, { reportId: data.id }, data.note);
    return { ok: true };
  });

export const adminSetNewsStatus = createServerFn({ method: "POST" })
  .middleware([mod])
  .inputValidator((d) => z.object({ postId: uuid, status: z.enum(["unverified", "verified", "disputed"]), note: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p } = await A.from("community_posts").select("id,category,source_url").eq("id", data.postId).maybeSingle();
    if (!p || p.category !== "news") throw new Error("Only news posts can be verified.");
    if (data.status === "verified" && !p.source_url) throw new Error("A news post needs a source link before it can be verified.");
    await A.from("community_posts").update({ news_status: data.status }).eq("id", data.postId);
    await audit((context as any).adminUserId, `news.${data.status}`, "post", data.postId, {}, data.note);
    return { ok: true };
  });
