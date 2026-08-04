import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { MONETIZATION_RULES } from "@/lib/creator-rules";

/** Creator dashboard: views, watch hours, followers, rating, monetization state. */
export const getMyCreatorStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: posts }, { count: followers }, { data: profile }, { data: creator }] = await Promise.all([
      supabase.from("community_posts").select("id, like_count, comment_count, created_at").eq("user_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("profiles").select("full_name, username, avatar_url, bio").eq("id", userId).maybeSingle(),
      supabase.from("creator_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    const postIds = (posts ?? []).map((p) => p.id);
    let views = 0;
    let watchSeconds = 0;
    let avgRating = 0;
    let ratingsCount = 0;
    if (postIds.length) {
      const [{ data: vrows }, { data: rrows }] = await Promise.all([
        supabase.from("post_views").select("watch_seconds").in("post_id", postIds),
        supabase.from("post_ratings").select("stars").in("post_id", postIds),
      ]);
      views = (vrows ?? []).length;
      watchSeconds = (vrows ?? []).reduce((s, v) => s + Number(v.watch_seconds ?? 0), 0);
      ratingsCount = (rrows ?? []).length;
      avgRating = ratingsCount ? (rrows ?? []).reduce((s, r) => s + Number(r.stars), 0) / ratingsCount : 0;
    }

    const followerCount = followers ?? 0;
    const watchHours = watchSeconds / 3600;
    const eligible =
      followerCount >= MONETIZATION_RULES.followers &&
      avgRating >= MONETIZATION_RULES.avgRating &&
      ratingsCount >= MONETIZATION_RULES.ratingsCount &&
      watchHours >= MONETIZATION_RULES.watchHours;

    return {
      profile: profile ?? null,
      posts: posts ?? [],
      followers: followerCount,
      views,
      watchHours: Math.round(watchHours * 10) / 10,
      avgRating: Math.round(avgRating * 10) / 10,
      ratingsCount,
      likes: (posts ?? []).reduce((s, p) => s + Number(p.like_count ?? 0), 0),
      comments: (posts ?? []).reduce((s, p) => s + Number(p.comment_count ?? 0), 0),
      eligible,
      status: creator?.status ?? "none",
      monetized: creator?.monetized ?? false,
      adminNote: creator?.admin_note ?? null,
      rules: MONETIZATION_RULES,
    };
  });

/** Apply for monetization — admin reviews and approves. */
export const applyForMonetization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: posts }, { count: followers }] = await Promise.all([
      supabaseAdmin.from("community_posts").select("id").eq("user_id", userId),
      supabaseAdmin.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
    ]);
    const postIds = (posts ?? []).map((p) => p.id);
    let watchSeconds = 0;
    let views = 0;
    let stars: number[] = [];
    if (postIds.length) {
      const [{ data: vrows }, { data: rrows }] = await Promise.all([
        supabaseAdmin.from("post_views").select("watch_seconds").in("post_id", postIds),
        supabaseAdmin.from("post_ratings").select("stars").in("post_id", postIds),
      ]);
      views = (vrows ?? []).length;
      watchSeconds = (vrows ?? []).reduce((s, v) => s + Number(v.watch_seconds ?? 0), 0);
      stars = (rrows ?? []).map((r) => Number(r.stars));
    }
    const avg = stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : 0;
    const followerCount = followers ?? 0;
    const watchHours = watchSeconds / 3600;

    if (
      followerCount < MONETIZATION_RULES.followers ||
      avg < MONETIZATION_RULES.avgRating ||
      stars.length < MONETIZATION_RULES.ratingsCount ||
      watchHours < MONETIZATION_RULES.watchHours
    ) {
      throw new Error("You do not meet the monetization requirements yet.");
    }

    const { error } = await supabaseAdmin.from("creator_profiles").upsert(
      {
        user_id: userId,
        applied_at: new Date().toISOString(),
        status: "pending",
        followers_count: followerCount,
        avg_rating: Math.round(avg * 100) / 100,
        ratings_count: stars.length,
        watch_seconds: watchSeconds,
        total_views: views,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Record a view / watch time on a community post. */
export const recordPostView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ postId: z.string().uuid(), seconds: z.number().int().min(0).max(3600).default(0) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await supabase.from("post_views").insert({
      post_id: data.postId,
      user_id: userId,
      watch_seconds: data.seconds,
    });
    return { ok: true };
  });

/** Rate a post 1–5 stars (one rating per user per post). */
export const ratePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ postId: z.string().uuid(), stars: z.number().int().min(1).max(5) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("post_ratings")
      .upsert({ post_id: data.postId, user_id: userId, stars: data.stars }, { onConflict: "post_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
