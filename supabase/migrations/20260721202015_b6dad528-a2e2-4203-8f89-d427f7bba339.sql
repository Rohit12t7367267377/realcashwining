
-- =========================================================
-- CRICKET
-- =========================================================
CREATE TABLE IF NOT EXISTS public.cricket_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE,
  name TEXT NOT NULL,
  status TEXT,
  venue TEXT,
  date_time TIMESTAMPTZ,
  team_a TEXT,
  team_b TEXT,
  score_a TEXT,
  score_b TEXT,
  match_type TEXT,
  is_live BOOLEAN DEFAULT false,
  raw JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cricket_matches TO anon, authenticated;
GRANT ALL ON public.cricket_matches TO service_role;
ALTER TABLE public.cricket_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cricket" ON public.cricket_matches FOR SELECT USING (true);
CREATE POLICY "Admin write cricket" ON public.cricket_matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings(key,value) VALUES
  ('cricket_enabled','true'::jsonb),
  ('cricket_api_provider','"cricapi"'::jsonb),
  ('cricket_api_key','""'::jsonb),
  ('cricket_refresh_seconds','60'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- MEMBERSHIPS (VIP)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.memberships TO anon, authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read memberships" ON public.memberships FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin write memberships" ON public.memberships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.user_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_memberships TO authenticated;
GRANT ALL ON public.user_memberships TO service_role;
ALTER TABLE public.user_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own membership read" ON public.user_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin write user_memberships" ON public.user_memberships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- COUPONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL DEFAULT 'wallet_credit',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  xp_amount INTEGER DEFAULT 0,
  max_redemptions INTEGER,
  per_user_limit INTEGER DEFAULT 1,
  redemptions INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Auth read active coupons" ON public.coupons FOR SELECT TO authenticated USING (active);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) DEFAULT 0,
  xp_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, user_id)
);
GRANT SELECT, INSERT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own redemptions read" ON public.coupon_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- =========================================================
-- SOCIAL: FOLLOWS + COMMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read follows" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Follow yourself only" ON public.follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Unfollow yourself only" ON public.follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.contest_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.contest_comments TO authenticated;
GRANT ALL ON public.contest_comments TO service_role;
ALTER TABLE public.contest_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read visible comments" ON public.contest_comments FOR SELECT TO authenticated USING (NOT hidden OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Post own comment" ON public.contest_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own comment" ON public.contest_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin moderate" ON public.contest_comments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- FEEDBACK, FAQ, BANNERS, UPDATES, BROADCASTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  category TEXT,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'open',
  admin_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own feedback read" ON public.feedback FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Post own feedback" ON public.feedback FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin manage feedback" ON public.feedback FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faqs TO anon, authenticated;
GRANT ALL ON public.faqs TO service_role;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read active faqs" ON public.faqs FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin manage faqs" ON public.faqs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  cta_label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.banners TO anon, authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read active banners" ON public.banners FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin manage banners" ON public.banners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.app_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  message TEXT,
  url TEXT,
  force_update BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_updates TO anon, authenticated;
GRANT ALL ON public.app_updates TO service_role;
ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read active updates" ON public.app_updates FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin manage updates" ON public.app_updates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.broadcasts TO anon, authenticated;
GRANT ALL ON public.broadcasts TO service_role;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read active broadcasts" ON public.broadcasts FOR SELECT USING (active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin manage broadcasts" ON public.broadcasts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- TRUST & SAFETY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  doc_number TEXT NOT NULL,
  doc_image_url TEXT,
  selfie_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.kyc_submissions TO authenticated;
GRANT ALL ON public.kyc_submissions TO service_role;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own kyc read" ON public.kyc_submissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Submit own kyc" ON public.kyc_submissions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admin update kyc" ON public.kyc_submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.device_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  user_agent TEXT,
  ip TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, device_id)
);
GRANT SELECT, INSERT, UPDATE ON public.device_bindings TO authenticated;
GRANT ALL ON public.device_bindings TO service_role;
ALTER TABLE public.device_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own devices read" ON public.device_bindings FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Bind own device" ON public.device_bindings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own device" ON public.device_bindings FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.anticheat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_id UUID REFERENCES public.contest_attempts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.anticheat_events TO authenticated;
GRANT ALL ON public.anticheat_events TO service_role;
ALTER TABLE public.anticheat_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own events read" ON public.anticheat_events FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Post own event" ON public.anticheat_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  resolved BOOLEAN NOT NULL DEFAULT false,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fraud_flags TO authenticated;
GRANT ALL ON public.fraud_flags TO service_role;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage fraud" ON public.fraud_flags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Anti-cheat + safety settings
INSERT INTO public.app_settings(key,value) VALUES
  ('anticheat_enabled','true'::jsonb),
  ('anticheat_tab_switch_limit','3'::jsonb),
  ('device_binding_enabled','true'::jsonb),
  ('kyc_required_for_withdraw','true'::jsonb),
  ('email_verification_required','false'::jsonb),
  ('maintenance_mode','false'::jsonb),
  ('maintenance_message','"We''ll be back shortly."'::jsonb),
  ('vip_enabled','true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- COUPON REDEMPTION RPC
-- =========================================================
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code TEXT)
RETURNS TABLE(amount NUMERIC, xp_amount INTEGER, note TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_c RECORD;
  v_count INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO v_c FROM public.coupons WHERE code = upper(_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid code'; END IF;
  IF NOT v_c.active THEN RAISE EXCEPTION 'Code is inactive'; END IF;
  IF v_c.expires_at IS NOT NULL AND v_c.expires_at < now() THEN RAISE EXCEPTION 'Code expired'; END IF;
  IF v_c.max_redemptions IS NOT NULL AND v_c.redemptions >= v_c.max_redemptions THEN RAISE EXCEPTION 'Code fully redeemed'; END IF;
  SELECT count(*) INTO v_count FROM public.coupon_redemptions WHERE coupon_id = v_c.id AND user_id = v_user;
  IF v_count >= coalesce(v_c.per_user_limit,1) THEN RAISE EXCEPTION 'Already redeemed'; END IF;

  INSERT INTO public.coupon_redemptions(coupon_id,user_id,amount,xp_amount)
    VALUES (v_c.id, v_user, v_c.amount, coalesce(v_c.xp_amount,0));
  UPDATE public.coupons SET redemptions = redemptions + 1 WHERE id = v_c.id;

  IF coalesce(v_c.amount,0) > 0 THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + v_c.amount WHERE id = v_user;
    INSERT INTO public.transactions(user_id,type,amount,note) VALUES (v_user,'credit',v_c.amount,'Coupon: ' || v_c.code);
  END IF;
  IF coalesce(v_c.xp_amount,0) > 0 THEN
    PERFORM public.grant_xp(v_user, v_c.xp_amount, 'coupon:' || v_c.code, v_c.id, '{}'::jsonb);
  END IF;

  RETURN QUERY SELECT v_c.amount, v_c.xp_amount, v_c.note;
END; $$;
