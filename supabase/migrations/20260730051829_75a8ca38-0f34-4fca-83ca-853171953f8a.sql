
-- mutual follow helper
CREATE OR REPLACE FUNCTION public.is_mutual_follow(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _a = _b OR (
    EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _a AND following_id = _b)
    AND EXISTS (SELECT 1 FROM public.follows WHERE follower_id = _b AND following_id = _a)
  )
$$;

CREATE TABLE public.community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  body text NOT NULL DEFAULT '',
  media_url text,
  media_type text CHECK (media_type IN ('image','video')),
  hidden boolean NOT NULL DEFAULT false,
  like_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT ALL ON public.community_posts TO service_role;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts visible" ON public.community_posts FOR SELECT TO authenticated
  USING (hidden = false OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "posts insert own" ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "posts update own or admin" ON public.community_posts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "posts delete own or admin" ON public.community_posts FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.post_likes (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes visible" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes insert mutual" ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND public.is_mutual_follow(auth.uid(), p.user_id)
  ));
CREATE POLICY "likes delete own" ON public.post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments visible" ON public.post_comments FOR SELECT TO authenticated
  USING (hidden = false OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "comments insert mutual" ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND public.is_mutual_follow(auth.uid(), p.user_id)
  ));
CREATE POLICY "comments update own or admin" ON public.post_comments FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "comments delete own or admin" ON public.post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_community_posts_created ON public.community_posts(created_at DESC);
CREATE INDEX idx_post_comments_post ON public.post_comments(post_id, created_at);

CREATE OR REPLACE FUNCTION public.sync_post_counts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'post_likes' THEN
    UPDATE public.community_posts SET like_count = (SELECT count(*) FROM public.post_likes WHERE post_id = COALESCE(NEW.post_id, OLD.post_id))
      WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  ELSE
    UPDATE public.community_posts SET comment_count = (SELECT count(*) FROM public.post_comments WHERE post_id = COALESCE(NEW.post_id, OLD.post_id) AND hidden = false)
      WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_like_counts AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_counts();
CREATE TRIGGER trg_comment_counts AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_counts();
CREATE TRIGGER trg_posts_touch BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.app_settings(key, value) VALUES ('community_moderation', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;
