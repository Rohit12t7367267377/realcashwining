-- STORE PRODUCTS
CREATE TABLE public.store_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'cash',
  stock integer NOT NULL DEFAULT 0,
  unlimited_stock boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.store_products TO anon, authenticated;
GRANT ALL ON public.store_products TO service_role;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON public.store_products FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage products" ON public.store_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- STORE ORDERS
CREATE TABLE public.store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.store_products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'cash',
  note text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.store_orders TO authenticated;
GRANT ALL ON public.store_orders TO service_role;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.store_orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own orders" ON public.store_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage orders" ON public.store_orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PRIZE AWARDS
CREATE TABLE public.prize_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  period_key text NOT NULL,
  rank integer,
  kind text NOT NULL DEFAULT 'cash',
  amount numeric NOT NULL DEFAULT 0,
  description text,
  status text NOT NULL DEFAULT 'awarded',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prize_awards TO authenticated;
GRANT ALL ON public.prize_awards TO service_role;
ALTER TABLE public.prize_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in can view prizes" ON public.prize_awards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage prizes" ON public.prize_awards FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ADS
CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  image_url text,
  link_url text,
  cta_label text,
  audience text NOT NULL DEFAULT 'all',
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users view active ads" ON public.ads FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage ads" ON public.ads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ad_targets (
  ad_id uuid NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_id, user_id)
);
GRANT SELECT ON public.ad_targets TO authenticated;
GRANT ALL ON public.ad_targets TO service_role;
ALTER TABLE public.ad_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ad targets" ON public.ad_targets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage ad targets" ON public.ad_targets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CREATOR PROFILES
CREATE TABLE public.creator_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  applied_at timestamptz,
  status text NOT NULL DEFAULT 'none',
  monetized boolean NOT NULL DEFAULT false,
  followers_count integer NOT NULL DEFAULT 0,
  avg_rating numeric NOT NULL DEFAULT 0,
  ratings_count integer NOT NULL DEFAULT 0,
  watch_seconds bigint NOT NULL DEFAULT 0,
  total_views bigint NOT NULL DEFAULT 0,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.creator_profiles TO authenticated;
GRANT ALL ON public.creator_profiles TO service_role;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own creator profile" ON public.creator_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users create own creator profile" ON public.creator_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage creator profiles" ON public.creator_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- POST VIEWS
CREATE TABLE public.post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  watch_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.post_views TO authenticated;
GRANT ALL ON public.post_views TO service_role;
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own views" ON public.post_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner or admin view post views" ON public.post_views FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
  OR auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_views.post_id AND p.user_id = auth.uid())
);

-- POST RATINGS
CREATE TABLE public.post_ratings (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_ratings TO authenticated;
GRANT ALL ON public.post_ratings TO service_role;
ALTER TABLE public.post_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users view ratings" ON public.post_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own rating" ON public.post_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND stars BETWEEN 1 AND 5);
CREATE POLICY "Users update own rating" ON public.post_ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND stars BETWEEN 1 AND 5);
CREATE POLICY "Users delete own rating" ON public.post_ratings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER store_products_touch BEFORE UPDATE ON public.store_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER store_orders_touch BEFORE UPDATE ON public.store_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER ads_touch BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER creator_profiles_touch BEFORE UPDATE ON public.creator_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();