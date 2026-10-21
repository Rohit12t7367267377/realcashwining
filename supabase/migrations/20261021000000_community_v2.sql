-- Community v2: privacy, blocks, follow requests, education categories, saves, reports, creator ratings,
-- validated watch time, social notifications, and server-enforced messaging rules. Additive and re-runnable.

-- ---------------------------------------------------------------- settings & blocks
CREATE TABLE IF NOT EXISTS public.community_profile_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_private boolean NOT NULL DEFAULT false,
  allow_comments boolean NOT NULL DEFAULT true,
  interests text[] NOT NULL DEFAULT '{}' CHECK (cardinality(interests) <= 12),
  exam_interests text[] NOT NULL DEFAULT '{}' CHECK (cardinality(exam_interests) <= 12),
  education_level text CHECK (education_level IS NULL OR char_length(education_level) <= 60),
  cover_path text,
  notify_social boolean NOT NULL DEFAULT true,
  notify_messages boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_profile_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.community_profile_settings TO authenticated;
GRANT ALL ON public.community_profile_settings TO service_role;
DROP POLICY IF EXISTS "cps read" ON public.community_profile_settings;
CREATE POLICY "cps read" ON public.community_profile_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cps insert own" ON public.community_profile_settings;
CREATE POLICY "cps insert own" ON public.community_profile_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "cps update own" ON public.community_profile_settings;
CREATE POLICY "cps update own" ON public.community_profile_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
DROP POLICY IF EXISTS "blocks own read" ON public.user_blocks;
CREATE POLICY "blocks own read" ON public.user_blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());
DROP POLICY IF EXISTS "blocks own insert" ON public.user_blocks;
CREATE POLICY "blocks own insert" ON public.user_blocks FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS "blocks own delete" ON public.user_blocks;
CREATE POLICY "blocks own delete" ON public.user_blocks FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- ---------------------------------------------------------------- follows: requests for private accounts
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_status_check;
ALTER TABLE public.follows ADD CONSTRAINT follows_status_check CHECK (status IN ('pending','accepted'));

CREATE OR REPLACE FUNCTION public.is_private_account(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT is_private FROM public.community_profile_settings WHERE user_id = _uid), false)
$$;
CREATE OR REPLACE FUNCTION public.is_blocked_either(_a uuid, _b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_blocks WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a))
$$;
CREATE OR REPLACE FUNCTION public.is_accepted_follower(_follower uuid, _target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _follower AND following_id = _target AND status = 'accepted')
$$;
-- Can `_viewer` see `_author`'s protected content (posts, lists)?
CREATE OR REPLACE FUNCTION public.can_view_author(_viewer uuid, _author uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _viewer = _author OR (
    NOT public.is_blocked_either(_viewer, _author)
    AND (NOT public.is_private_account(_author) OR public.is_accepted_follower(_viewer, _author))
  )
$$;
-- Mutual follow (accepted both ways, nobody blocked): the messaging rule.
CREATE OR REPLACE FUNCTION public.is_mutual_follow(_a uuid, _b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _a = _b OR (
    NOT public.is_blocked_either(_a, _b)
    AND public.is_accepted_follower(_a, _b) AND public.is_accepted_follower(_b, _a)
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_private_account(uuid), public.is_blocked_either(uuid,uuid),
  public.is_accepted_follower(uuid,uuid), public.can_view_author(uuid,uuid), public.is_mutual_follow(uuid,uuid) TO authenticated, service_role;

-- The server decides the status: a client cannot self-accept a follow of a private account.
CREATE OR REPLACE FUNCTION public.follows_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_blocked_either(NEW.follower_id, NEW.following_id) THEN RAISE EXCEPTION 'You cannot follow this account'; END IF;
  NEW.status := CASE WHEN public.is_private_account(NEW.following_id) THEN 'pending' ELSE 'accepted' END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_follows_before_insert ON public.follows;
CREATE TRIGGER trg_follows_before_insert BEFORE INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION public.follows_before_insert();

-- Only the account being followed may accept, and only status can change.
REVOKE UPDATE ON public.follows FROM authenticated;
GRANT UPDATE (status) ON public.follows TO authenticated;
DROP POLICY IF EXISTS "Accept follow requests" ON public.follows;
CREATE POLICY "Accept follow requests" ON public.follows FOR UPDATE TO authenticated
  USING (following_id = auth.uid() AND status = 'pending') WITH CHECK (following_id = auth.uid() AND status = 'accepted');
-- Removing a follower: the followed account may delete the row too.
DROP POLICY IF EXISTS "Remove follower" ON public.follows;
CREATE POLICY "Remove follower" ON public.follows FOR DELETE TO authenticated USING (following_id = auth.uid());
DROP POLICY IF EXISTS "Anyone read follows" ON public.follows;
DROP POLICY IF EXISTS "Read permitted follows" ON public.follows;
CREATE POLICY "Read permitted follows" ON public.follows FOR SELECT TO authenticated USING (
  follower_id = auth.uid() OR following_id = auth.uid()
  OR (status = 'accepted' AND public.can_view_author(auth.uid(), following_id) AND public.can_view_author(auth.uid(), follower_id))
);

CREATE OR REPLACE FUNCTION public.user_blocks_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.follows WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id) OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_user_blocks_after_insert ON public.user_blocks;
CREATE TRIGGER trg_user_blocks_after_insert AFTER INSERT ON public.user_blocks FOR EACH ROW EXECUTE FUNCTION public.user_blocks_after_insert();

-- ---------------------------------------------------------------- posts: education categories, protected columns
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'post';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS exam_tag text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS education_level text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS source_published_on date;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS news_status text NOT NULL DEFAULT 'unverified';
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS quiz_contest_id uuid REFERENCES public.contests(id) ON DELETE SET NULL;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_category_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_category_check
  CHECK (category IN ('post','video','quiz','notes','exam_tip','news','discussion'));
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_news_status_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_news_status_check CHECK (news_status IN ('unverified','verified','disputed'));
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_news_needs_source;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_news_needs_source CHECK (category <> 'news' OR source_url IS NOT NULL) NOT VALID;
ALTER TABLE public.community_posts DROP CONSTRAINT IF EXISTS community_posts_media_type_check;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_media_type_check CHECK (media_type IS NULL OR media_type IN ('image','video','document'));
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON public.community_posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_user ON public.community_posts(user_id, created_at DESC);

-- All writes to posts/comments go through server functions that validate content policy and rate limits.
-- Direct client writes are limited to: delete own, and admin hide/unhide.
REVOKE INSERT, UPDATE ON public.community_posts FROM authenticated;
GRANT UPDATE (hidden) ON public.community_posts TO authenticated;
REVOKE INSERT, UPDATE ON public.post_comments FROM authenticated;
GRANT UPDATE (hidden) ON public.post_comments TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_hidden_flag() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN NEW.hidden := OLD.hidden; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_posts_guard_hidden ON public.community_posts;
CREATE TRIGGER trg_posts_guard_hidden BEFORE UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.guard_hidden_flag();
DROP TRIGGER IF EXISTS trg_comments_guard_hidden ON public.post_comments;
CREATE TRIGGER trg_comments_guard_hidden BEFORE UPDATE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.guard_hidden_flag();

DROP POLICY IF EXISTS "posts visible" ON public.community_posts;
CREATE POLICY "posts visible" ON public.community_posts FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  OR (hidden = false AND public.can_view_author(auth.uid(), user_id))
);
DROP POLICY IF EXISTS "posts insert own" ON public.community_posts;
CREATE POLICY "posts insert own" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Likes / comments: anyone who can see the post (mutual follow is only the messaging rule).
DROP POLICY IF EXISTS "likes insert mutual" ON public.post_likes;
DROP POLICY IF EXISTS "likes insert visible" ON public.post_likes;
CREATE POLICY "likes insert visible" ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id));
DROP POLICY IF EXISTS "likes visible" ON public.post_likes;
CREATE POLICY "likes visible" ON public.post_likes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id));
DROP POLICY IF EXISTS "comments insert mutual" ON public.post_comments;
DROP POLICY IF EXISTS "comments visible" ON public.post_comments;
CREATE POLICY "comments visible" ON public.post_comments FOR SELECT TO authenticated USING (
  (hidden = false OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id)
);
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE;
ALTER TABLE public.post_comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON public.post_comments(parent_id);
CREATE OR REPLACE FUNCTION public.comment_parent_ok() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.post_comments c WHERE c.id = NEW.parent_id AND c.post_id = NEW.post_id AND c.parent_id IS NULL
  ) THEN RAISE EXCEPTION 'Replies must target a top-level comment on the same post'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_comment_parent_ok ON public.post_comments;
CREATE TRIGGER trg_comment_parent_ok BEFORE INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.comment_parent_ok();

-- ---------------------------------------------------------------- saves
CREATE TABLE IF NOT EXISTS public.post_saves (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.post_saves TO authenticated;
GRANT ALL ON public.post_saves TO service_role;
DROP POLICY IF EXISTS "saves own read" ON public.post_saves;
CREATE POLICY "saves own read" ON public.post_saves FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "saves own insert" ON public.post_saves;
CREATE POLICY "saves own insert" ON public.post_saves FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id));
DROP POLICY IF EXISTS "saves own delete" ON public.post_saves;
CREATE POLICY "saves own delete" ON public.post_saves FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------- reports (moderation queue)
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post','comment','message','account','rating')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','misinformation','abuse','inappropriate','scam','copyright','off_topic','other')),
  details text CHECK (details IS NULL OR char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','actioned','dismissed')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_open ON public.content_reports(status, created_at DESC);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;
DROP POLICY IF EXISTS "reports own or admin read" ON public.content_reports;
CREATE POLICY "reports own or admin read" ON public.content_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "reports insert own" ON public.content_reports;
CREATE POLICY "reports insert own" ON public.content_reports FOR INSERT TO authenticated WITH CHECK (
  reporter_id = auth.uid() AND status = 'open' AND resolved_by IS NULL
  AND (target_type <> 'message' OR EXISTS (SELECT 1 FROM public.direct_messages m WHERE m.id = target_id AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())))
  AND (target_type <> 'post' OR EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = target_id))
);

-- ---------------------------------------------------------------- messaging rules enforced in the database
DROP POLICY IF EXISTS "Mutual followers can send messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Mutual accepted followers can send messages" ON public.direct_messages;
CREATE POLICY "Mutual accepted followers can send messages" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND sender_id <> recipient_id
  AND char_length(body) BETWEEN 1 AND 2000
  AND public.is_mutual_follow(auth.uid(), recipient_id)
);
CREATE OR REPLACE FUNCTION public.dm_rate_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.direct_messages WHERE sender_id = NEW.sender_id AND created_at > now() - interval '1 minute') >= 20 THEN
    RAISE EXCEPTION 'You are sending messages too fast. Please wait a moment.';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_dm_rate_limit ON public.direct_messages;
CREATE TRIGGER trg_dm_rate_limit BEFORE INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.dm_rate_limit();
-- Recipients may only flip read_at.
REVOKE UPDATE ON public.direct_messages FROM authenticated;
GRANT UPDATE (read_at) ON public.direct_messages TO authenticated;

-- ---------------------------------------------------------------- validated watch time
ALTER TABLE public.post_views ADD COLUMN IF NOT EXISTS view_date date;
UPDATE public.post_views SET view_date = created_at::date WHERE view_date IS NULL;
ALTER TABLE public.post_views ALTER COLUMN view_date SET DEFAULT current_date;
ALTER TABLE public.post_views ALTER COLUMN view_date SET NOT NULL;
ALTER TABLE public.post_views ADD COLUMN IF NOT EXISTS first_seen_at timestamptz;
UPDATE public.post_views SET first_seen_at = created_at WHERE first_seen_at IS NULL;
ALTER TABLE public.post_views ALTER COLUMN first_seen_at SET DEFAULT now();
ALTER TABLE public.post_views ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now();
-- One row per viewer per post per day for new data; legacy rows are left untouched.
CREATE UNIQUE INDEX IF NOT EXISTS post_views_daily_uniq ON public.post_views(post_id, user_id, view_date) WHERE view_date >= DATE '2026-10-21';
-- Clients can no longer insert raw watch seconds: only record_post_watch() writes.
REVOKE INSERT ON public.post_views FROM authenticated;

CREATE OR REPLACE FUNCTION public.record_post_watch(_post uuid, _seconds integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_post record; v_cap numeric; v_row record; v_new integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT id, user_id, duration_seconds INTO v_post FROM public.community_posts WHERE id = _post AND hidden = false;
  IF NOT FOUND OR NOT public.can_view_author(v_uid, v_post.user_id) THEN RAISE EXCEPTION 'Post not found'; END IF;
  IF v_post.user_id = v_uid THEN RETURN 0; END IF; -- own views never count
  _seconds := greatest(0, least(coalesce(_seconds, 0), 14400));
  INSERT INTO public.post_views (post_id, user_id, view_date, watch_seconds, first_seen_at, last_seen_at)
    VALUES (_post, v_uid, current_date, 0, now(), now())
    ON CONFLICT (post_id, user_id, view_date) WHERE view_date >= DATE '2026-10-21' DO NOTHING;
  SELECT * INTO v_row FROM public.post_views WHERE post_id = _post AND user_id = v_uid AND view_date = current_date ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_row.last_seen_at > now() - interval '2 seconds' AND v_row.watch_seconds > 0 THEN RETURN v_row.watch_seconds; END IF; -- throttle
  -- Watch time can never exceed real elapsed time (+5s tolerance) nor 2x the declared video length.
  v_cap := extract(epoch FROM (now() - v_row.first_seen_at)) + 5;
  IF v_post.duration_seconds IS NOT NULL AND v_post.duration_seconds > 0 THEN v_cap := least(v_cap, v_post.duration_seconds * 2); END IF;
  v_new := greatest(v_row.watch_seconds, least(_seconds, floor(v_cap)::int));
  UPDATE public.post_views SET watch_seconds = v_new, last_seen_at = now() WHERE id = v_row.id;
  RETURN v_new;
END; $$;
GRANT EXECUTE ON FUNCTION public.record_post_watch(uuid, integer) TO authenticated;

-- A view is "valid" after 5s, or half the video when it is shorter than 10s.
CREATE OR REPLACE FUNCTION public.creator_analytics(_creator uuid, _days integer DEFAULT 30)
RETURNS TABLE(day date, valid_views bigint, watch_seconds bigint, avg_view_seconds numeric, avg_pct_viewed numeric, likes bigint, comments bigint, new_followers bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _creator AND NOT public.has_role(auth.uid(), 'admin')) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  _days := greatest(1, least(coalesce(_days, 30), 90));
  RETURN QUERY
  WITH d AS (SELECT generate_series(current_date - (_days - 1), current_date, interval '1 day')::date AS day),
  v AS (
    SELECT pv.view_date AS day, count(*) FILTER (WHERE pv.watch_seconds >= least(5, greatest(1, coalesce(p.duration_seconds, 10) / 2))) AS vv,
           coalesce(sum(pv.watch_seconds), 0) AS ws,
           avg(pv.watch_seconds) FILTER (WHERE pv.watch_seconds > 0) AS avgs,
           avg(least(1.0, pv.watch_seconds::numeric / nullif(p.duration_seconds, 0))) FILTER (WHERE p.duration_seconds > 0 AND pv.watch_seconds > 0) AS pct
    FROM public.post_views pv JOIN public.community_posts p ON p.id = pv.post_id
    WHERE p.user_id = _creator AND pv.view_date >= current_date - (_days - 1) GROUP BY pv.view_date),
  l AS (SELECT pl.created_at::date AS day, count(*) AS n FROM public.post_likes pl JOIN public.community_posts p ON p.id = pl.post_id WHERE p.user_id = _creator AND pl.created_at >= current_date - (_days - 1) GROUP BY 1),
  c AS (SELECT pc.created_at::date AS day, count(*) AS n FROM public.post_comments pc JOIN public.community_posts p ON p.id = pc.post_id WHERE p.user_id = _creator AND pc.hidden = false AND pc.created_at >= current_date - (_days - 1) GROUP BY 1),
  f AS (SELECT created_at::date AS day, count(*) AS n FROM public.follows WHERE following_id = _creator AND status = 'accepted' AND created_at >= current_date - (_days - 1) GROUP BY 1)
  SELECT d.day, coalesce(v.vv, 0), coalesce(v.ws, 0)::bigint, round(coalesce(v.avgs, 0), 1), round(coalesce(v.pct, 0) * 100, 1),
         coalesce(l.n, 0), coalesce(c.n, 0), coalesce(f.n, 0)
  FROM d LEFT JOIN v USING (day) LEFT JOIN l USING (day) LEFT JOIN c USING (day) LEFT JOIN f USING (day) ORDER BY d.day;
END; $$;
GRANT EXECUTE ON FUNCTION public.creator_analytics(uuid, integer) TO authenticated;

-- ---------------------------------------------------------------- creator ratings & milestone
CREATE TABLE IF NOT EXISTS public.creator_ratings (
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 500),
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (creator_id, rater_id),
  CHECK (creator_id <> rater_id)
);
ALTER TABLE public.creator_ratings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.creator_ratings TO authenticated;
GRANT ALL ON public.creator_ratings TO service_role;
DROP POLICY IF EXISTS "ratings read" ON public.creator_ratings;
CREATE POLICY "ratings read" ON public.creator_ratings FOR SELECT TO authenticated
  USING (hidden = false OR rater_id = auth.uid() OR creator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Eligibility: not self, not blocked, accepted follower, has watched/liked at least one of the creator's posts,
-- account at least a day old, and at most 20 rating actions per day.
CREATE OR REPLACE FUNCTION public.rate_creator(_creator uuid, _stars integer, _comment text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF v_uid = _creator THEN RAISE EXCEPTION 'You cannot rate yourself'; END IF;
  IF _stars NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Stars must be 1 to 5'; END IF;
  IF public.is_blocked_either(v_uid, _creator) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NOT public.is_accepted_follower(v_uid, _creator) THEN RAISE EXCEPTION 'Follow this creator before rating'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_posts p WHERE p.user_id = _creator AND (
        EXISTS (SELECT 1 FROM public.post_views pv WHERE pv.post_id = p.id AND pv.user_id = v_uid AND pv.watch_seconds >= 5)
        OR EXISTS (SELECT 1 FROM public.post_likes pl WHERE pl.post_id = p.id AND pl.user_id = v_uid)))
  THEN RAISE EXCEPTION 'Watch or like one of this creator''s posts before rating'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uid AND u.created_at > now() - interval '1 day') THEN
    RAISE EXCEPTION 'New accounts can rate after 24 hours'; END IF;
  IF (SELECT count(*) FROM public.creator_ratings WHERE rater_id = v_uid AND updated_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Daily rating limit reached'; END IF;
  INSERT INTO public.creator_ratings (creator_id, rater_id, stars, comment) VALUES (_creator, v_uid, _stars, nullif(trim(_comment), ''))
  ON CONFLICT (creator_id, rater_id) DO UPDATE SET stars = EXCLUDED.stars, comment = EXCLUDED.comment, updated_at = now(), hidden = public.creator_ratings.hidden;
END; $$;
GRANT EXECUTE ON FUNCTION public.rate_creator(uuid, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.creator_rating_summary(_creator uuid)
RETURNS TABLE(avg_stars numeric, ratings integer, s1 integer, s2 integer, s3 integer, s4 integer, s5 integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(round(avg(stars)::numeric, 2), 0), count(*)::int,
         (count(*) FILTER (WHERE stars = 1))::int, (count(*) FILTER (WHERE stars = 2))::int, (count(*) FILTER (WHERE stars = 3))::int,
         (count(*) FILTER (WHERE stars = 4))::int, (count(*) FILTER (WHERE stars = 5))::int
  FROM public.creator_ratings WHERE creator_id = _creator AND hidden = false AND public.can_view_author(auth.uid(), _creator)
$$;
GRANT EXECUTE ON FUNCTION public.creator_rating_summary(uuid) TO authenticated;

INSERT INTO public.app_settings (key, value) VALUES ('creator_milestone', '{"enabled":true,"followers":500,"avgRating":4,"minRatings":20}'::jsonb) ON CONFLICT (key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.creator_milestone(_creator uuid)
RETURNS TABLE(enabled boolean, followers integer, avg_stars numeric, ratings integer, need_followers integer, need_avg numeric, need_ratings integer, eligible boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg jsonb; f int; a numeric; r int;
BEGIN
  SELECT value INTO cfg FROM public.app_settings WHERE key = 'creator_milestone';
  cfg := coalesce(cfg, '{"enabled":true,"followers":500,"avgRating":4,"minRatings":20}'::jsonb);
  SELECT count(*)::int INTO f FROM public.follows WHERE following_id = _creator AND status = 'accepted';
  SELECT coalesce(round(avg(stars)::numeric, 2), 0), count(*)::int INTO a, r FROM public.creator_ratings WHERE creator_id = _creator AND hidden = false;
  RETURN QUERY SELECT coalesce((cfg->>'enabled')::boolean, true), f, a, r, (cfg->>'followers')::int, (cfg->>'avgRating')::numeric, (cfg->>'minRatings')::int,
    (coalesce((cfg->>'enabled')::boolean, true) AND f >= (cfg->>'followers')::int AND r >= (cfg->>'minRatings')::int AND a >= (cfg->>'avgRating')::numeric);
END; $$;
GRANT EXECUTE ON FUNCTION public.creator_milestone(uuid) TO authenticated;

-- ---------------------------------------------------------------- people search & profile summary
CREATE OR REPLACE FUNCTION public.community_search_people(_q text, _limit integer DEFAULT 20)
RETURNS TABLE(id uuid, username text, full_name text, avatar_url text, bio text, is_private boolean, followers integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.full_name, p.avatar_url, p.bio, public.is_private_account(p.id),
         (SELECT count(*)::int FROM public.follows f WHERE f.following_id = p.id AND f.status = 'accepted')
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.banned = false AND p.id <> auth.uid() AND NOT public.is_blocked_either(auth.uid(), p.id)
    AND char_length(trim(_q)) >= 2
    AND (p.username ILIKE '%' || replace(replace(trim(_q), '%', ''), '_', '') || '%' OR p.full_name ILIKE '%' || replace(replace(trim(_q), '%', ''), '_', '') || '%')
  ORDER BY (p.username ILIKE trim(_q) || '%') DESC, 7 DESC LIMIT least(coalesce(_limit, 20), 50)
$$;
GRANT EXECUTE ON FUNCTION public.community_search_people(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_profile_summary(_user uuid)
RETURNS TABLE(id uuid, username text, full_name text, avatar_url text, bio text, is_private boolean, followers integer, following integer, posts integer,
  viewer_follows boolean, viewer_pending boolean, follows_viewer boolean, can_view boolean, viewer_blocked boolean, blocked_by_target boolean, can_message boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.full_name, p.avatar_url, p.bio, public.is_private_account(p.id),
    (SELECT count(*)::int FROM public.follows f WHERE f.following_id = p.id AND f.status = 'accepted'),
    (SELECT count(*)::int FROM public.follows f WHERE f.follower_id = p.id AND f.status = 'accepted'),
    CASE WHEN public.can_view_author(auth.uid(), p.id) THEN (SELECT count(*)::int FROM public.community_posts c WHERE c.user_id = p.id AND c.hidden = false) ELSE 0 END,
    public.is_accepted_follower(auth.uid(), p.id),
    EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = p.id AND f.status = 'pending'),
    public.is_accepted_follower(p.id, auth.uid()),
    public.can_view_author(auth.uid(), p.id),
    EXISTS (SELECT 1 FROM public.user_blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = p.id),
    EXISTS (SELECT 1 FROM public.user_blocks b WHERE b.blocker_id = p.id AND b.blocked_id = auth.uid()),
    (p.id <> auth.uid() AND public.is_mutual_follow(auth.uid(), p.id))
  FROM public.profiles p WHERE p.id = _user AND auth.uid() IS NOT NULL AND p.banned = false
$$;
GRANT EXECUTE ON FUNCTION public.community_profile_summary(uuid) TO authenticated;

-- ---------------------------------------------------------------- per-post stats for feed ranking
CREATE OR REPLACE FUNCTION public.community_post_stats(_ids uuid[])
RETURNS TABLE(post_id uuid, valid_views bigint, avg_pct numeric, saves bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
    (SELECT count(*) FROM public.post_views v WHERE v.post_id = p.id AND v.watch_seconds >= 5),
    (SELECT round(coalesce(avg(least(1.0, v.watch_seconds::numeric / nullif(p.duration_seconds, 0))), 0), 3) FROM public.post_views v WHERE v.post_id = p.id AND v.watch_seconds > 0),
    (SELECT count(*) FROM public.post_saves s WHERE s.post_id = p.id)
  FROM public.community_posts p WHERE p.id = ANY(_ids) AND public.can_view_author(auth.uid(), p.user_id) AND p.hidden = false
$$;
GRANT EXECUTE ON FUNCTION public.community_post_stats(uuid[]) TO authenticated;

-- ---------------------------------------------------------------- notifications (social)
CREATE TABLE IF NOT EXISTS public.community_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('follow','follow_request','follow_accept','like','comment','reply','message','milestone','moderation')),
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_cnotif_user ON public.community_notifications(user_id, created_at DESC);
ALTER TABLE public.community_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.community_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.community_notifications TO authenticated;
GRANT ALL ON public.community_notifications TO service_role;
DROP POLICY IF EXISTS "cnotif own read" ON public.community_notifications;
CREATE POLICY "cnotif own read" ON public.community_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "cnotif own mark read" ON public.community_notifications;
CREATE POLICY "cnotif own mark read" ON public.community_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.push_social_notification(_user uuid, _actor uuid, _kind text, _post uuid, _key text, _messages boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  IF _user IS NULL OR _user = _actor THEN RETURN; END IF;
  IF _actor IS NOT NULL AND public.is_blocked_either(_user, _actor) THEN RETURN; END IF;
  SELECT CASE WHEN _messages THEN coalesce(notify_messages, true) ELSE coalesce(notify_social, true) END INTO ok
    FROM (SELECT 1) x LEFT JOIN public.community_profile_settings s ON s.user_id = _user;
  IF ok = false THEN RETURN; END IF;
  INSERT INTO public.community_notifications (user_id, actor_id, kind, post_id, dedupe_key) VALUES (_user, _actor, _kind, _post, _key)
  ON CONFLICT (user_id, dedupe_key) DO UPDATE SET created_at = now(), read_at = NULL WHERE public.community_notifications.kind = 'message';
END; $$;

CREATE OR REPLACE FUNCTION public.notify_on_follow() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.push_social_notification(NEW.following_id, NEW.follower_id, CASE WHEN NEW.status = 'pending' THEN 'follow_request' ELSE 'follow' END, NULL, 'follow:' || NEW.follower_id);
  ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM public.push_social_notification(NEW.follower_id, NEW.following_id, 'follow_accept', NULL, 'accept:' || NEW.following_id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow AFTER INSERT OR UPDATE ON public.follows FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

CREATE OR REPLACE FUNCTION public.notify_on_like() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid;
BEGIN SELECT user_id INTO a FROM public.community_posts WHERE id = NEW.post_id;
  PERFORM public.push_social_notification(a, NEW.user_id, 'like', NEW.post_id, 'like:' || NEW.post_id || ':' || NEW.user_id); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_notify_like ON public.post_likes;
CREATE TRIGGER trg_notify_like AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

CREATE OR REPLACE FUNCTION public.notify_on_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a uuid; pa uuid;
BEGIN
  SELECT user_id INTO a FROM public.community_posts WHERE id = NEW.post_id;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO pa FROM public.post_comments WHERE id = NEW.parent_id;
    PERFORM public.push_social_notification(pa, NEW.user_id, 'reply', NEW.post_id, 'reply:' || NEW.id);
  END IF;
  IF a IS DISTINCT FROM pa THEN PERFORM public.push_social_notification(a, NEW.user_id, 'comment', NEW.post_id, 'comment:' || NEW.id); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_comment ON public.post_comments;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

CREATE OR REPLACE FUNCTION public.notify_on_dm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.push_social_notification(NEW.recipient_id, NEW.sender_id, 'message', NULL, 'msg:' || NEW.sender_id, true); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_notify_dm ON public.direct_messages;
CREATE TRIGGER trg_notify_dm AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.notify_on_dm();

CREATE OR REPLACE FUNCTION public.notify_on_moderation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.hidden = true AND OLD.hidden = false AND auth.uid() IS NOT NULL AND auth.uid() <> NEW.user_id THEN
    PERFORM public.push_social_notification(NEW.user_id, NULL, 'moderation', NEW.id, 'mod:' || NEW.id);
  END IF; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_moderation ON public.community_posts;
CREATE TRIGGER trg_notify_moderation AFTER UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.notify_on_moderation();

-- ---------------------------------------------------------------- storage: media readable only where the post/profile is visible
DROP POLICY IF EXISTS "community read" ON storage.objects;
CREATE POLICY "community read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'community' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.community_posts p WHERE p.media_url = name)
    OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.avatar_url = name)
    OR EXISTS (SELECT 1 FROM public.community_profile_settings s WHERE s.cover_path = name)
  )
);
