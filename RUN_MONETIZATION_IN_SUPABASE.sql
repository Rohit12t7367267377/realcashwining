-- Paste this whole file into Supabase > SQL Editor > Run. Safe to run more than once.
-- It creates the AI credit system. Everything stays OFF until you enable it in Admin > AI Credits & Plans.
-- Admin-controlled monetization: AI credits, feature costs, free/paid limits, plan credits, offers and an audit ledger.
-- Everything is OFF by default (app_settings 'monetization'.enabled = false), so nothing changes until the admin turns it on.
-- Reuses: profiles/auth.users (accounts), memberships + user_memberships (plans), app_settings (global settings), has_role().

-- 1. Plans get credit fields (existing columns/data untouched)
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS credits_per_cycle integer NOT NULL DEFAULT 0 CHECK (credits_per_cycle >= 0),
  ADD COLUMN IF NOT EXISTS unlimited_ai boolean NOT NULL DEFAULT false;

-- 2. Feature catalogue: one global row per metered feature (no per-user configuration anywhere)
CREATE TABLE IF NOT EXISTS public.monetization_features (
  feature_key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  credit_cost integer NOT NULL DEFAULT 1 CHECK (credit_cost >= 0),
  free_daily_limit integer CHECK (free_daily_limit IS NULL OR free_daily_limit >= 0),
  free_monthly_limit integer CHECK (free_monthly_limit IS NULL OR free_monthly_limit >= 0),
  paid_daily_limit integer CHECK (paid_daily_limit IS NULL OR paid_daily_limit >= 0),
  paid_monthly_limit integer CHECK (paid_monthly_limit IS NULL OR paid_monthly_limit >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.monetization_features (feature_key, label, description, credit_cost, free_daily_limit, free_monthly_limit, sort_order) VALUES
  ('guru_chat',   'Guru.AI chat',               'Universal AI chat and voice assistant answers',        1, 20,  300, 1),
  ('guru_doubt',  'Doubt solving',              'Doubts asked to the AI teacher',                       1, 15,  200, 2),
  ('guru_lesson', 'AI lessons (Explain / Classroom)', 'Explain Easy/Deeply, classroom lessons',         2, 10,  120, 3),
  ('guru_notes',  'Notes and topic quizzes',    'AI notes and quizzes for a topic',                     1, 30,  400, 4),
  ('guru_photo',  'Photo question solver',      'Solve a question from a photo',                        2, 5,   60,  5),
  ('exam_ai',     'Exam practice and plans',    'Competitive exam questions and study plans',           1, 20,  300, 6),
  ('college_ai',  'College coding and review',  'College coding practice and code review',             1, 15,  200, 7),
  ('guru_voice',  'Teacher voice',              'Spoken lessons (charged per request, 0 by default)',   0, NULL, NULL, 8)
ON CONFLICT (feature_key) DO NOTHING;

-- 3. Balances, ledger, usage counters
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  free_balance integer NOT NULL DEFAULT 0 CHECK (free_balance >= 0),
  paid_balance integer NOT NULL DEFAULT 0 CHECK (paid_balance >= 0),
  free_expires_at timestamptz,
  signup_granted_at timestamptz,
  last_free_reset_month text,
  last_plan_cycle text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  bucket text NOT NULL CHECK (bucket IN ('free','paid')),
  free_after integer NOT NULL,
  paid_after integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('signup','monthly_reset','plan','admin','usage','expiry','offer','refund')),
  feature_key text,
  ref text,
  note text,
  created_by uuid,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON public.credit_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS credit_ledger_kind_idx ON public.credit_ledger (kind, created_at DESC);
CREATE TABLE IF NOT EXISTS public.feature_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  period text NOT NULL CHECK (period IN ('day','month')),
  period_start date NOT NULL,
  used integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, feature_key, period, period_start)
);

-- 4. Offers (bonus credits, optionally pointing at a plan)
CREATE TABLE IF NOT EXISTS public.monetization_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  bonus_credits integer NOT NULL DEFAULT 0 CHECK (bonus_credits >= 0),
  plan_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  discount_percent integer CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 100),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redeemed_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.offer_redemptions (
  offer_id uuid NOT NULL REFERENCES public.monetization_offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_id, user_id)
);

-- 5. Row level security: users may read only their own rows; every write goes through the SECURITY DEFINER functions below
ALTER TABLE public.monetization_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetization_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_redemptions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.monetization_features, public.monetization_offers TO authenticated;
GRANT SELECT ON public.user_credits, public.credit_ledger, public.feature_usage, public.offer_redemptions TO authenticated;
GRANT ALL ON public.monetization_features, public.user_credits, public.credit_ledger, public.feature_usage, public.monetization_offers, public.offer_redemptions TO service_role;
DROP POLICY IF EXISTS "features readable" ON public.monetization_features;
CREATE POLICY "features readable" ON public.monetization_features FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "own credits" ON public.user_credits;
CREATE POLICY "own credits" ON public.user_credits FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own ledger" ON public.credit_ledger;
CREATE POLICY "own ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own usage" ON public.feature_usage;
CREATE POLICY "own usage" ON public.feature_usage FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "active offers readable" ON public.monetization_offers;
CREATE POLICY "active offers readable" ON public.monetization_offers FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "own redemptions" ON public.offer_redemptions;
CREATE POLICY "own redemptions" ON public.offer_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- 6. Global settings (one JSON document, edited from the admin dashboard)
INSERT INTO public.app_settings (key, value) VALUES ('monetization', jsonb_build_object(
  'enabled', false,
  'signup_credits', 30,
  'signup_credit_expiry_days', 0,
  'monthly_free_credits', 0,
  'upgrade', jsonb_build_object(
    'title', 'Upgrade to keep learning',
    'message', 'You have used your free credits or reached today''s limit. Pick a plan to continue.',
    'cta_label', 'See plans',
    'cta_url', '/subscribe',
    'show_plans', true,
    'show_offers', true)
)) ON CONFLICT (key) DO NOTHING;

-- 7. Helpers ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mon_settings() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT value FROM public.app_settings WHERE key = 'monetization'), '{}'::jsonb)
$$;

-- Records one ledger line and moves the balance. Returns false when the idempotency key was already used.
CREATE OR REPLACE FUNCTION public.mon_move(_user uuid, _delta integer, _bucket text, _kind text, _feature text, _ref text, _note text, _by uuid, _idem text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f integer; p integer; applied integer;
BEGIN
  IF _delta = 0 THEN RETURN true; END IF;
  IF _idem IS NOT NULL AND EXISTS (SELECT 1 FROM public.credit_ledger WHERE idempotency_key = _idem) THEN RETURN false; END IF;
  IF _bucket = 'free' THEN
    UPDATE public.user_credits SET free_balance = greatest(0, free_balance + _delta), updated_at = now() WHERE user_id = _user RETURNING free_balance, paid_balance INTO f, p;
  ELSE
    UPDATE public.user_credits SET paid_balance = greatest(0, paid_balance + _delta), updated_at = now() WHERE user_id = _user RETURNING free_balance, paid_balance INTO f, p;
  END IF;
  INSERT INTO public.credit_ledger (user_id, delta, bucket, free_after, paid_after, kind, feature_key, ref, note, created_by, idempotency_key)
  VALUES (_user, _delta, _bucket, f, p, _kind, _feature, _ref, _note, _by, _idem);
  RETURN true;
END $$;

-- Lazy automation, safe to call at any time: signup grant, free-credit expiry, monthly reset, plan credits per cycle.
CREATE OR REPLACE FUNCTION public.mon_ensure_user(_user uuid) RETURNS public.user_credits LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb := public.mon_settings(); row public.user_credits; signup integer; exp_days integer; monthly integer;
        mkey text := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM'); plan record; cyc integer; cyc_key text;
BEGIN
  INSERT INTO public.user_credits (user_id) VALUES (_user) ON CONFLICT (user_id) DO NOTHING;
  SELECT * INTO row FROM public.user_credits WHERE user_id = _user FOR UPDATE;
  signup := coalesce((s->>'signup_credits')::integer, 0);
  exp_days := coalesce((s->>'signup_credit_expiry_days')::integer, 0);
  monthly := coalesce((s->>'monthly_free_credits')::integer, 0);

  -- expire old free credits
  IF row.free_expires_at IS NOT NULL AND now() >= row.free_expires_at THEN
    IF row.free_balance > 0 THEN PERFORM public.mon_move(_user, -row.free_balance, 'free', 'expiry', NULL, NULL, 'Free credits expired', NULL, NULL); END IF;
    UPDATE public.user_credits SET free_expires_at = NULL WHERE user_id = _user;
  END IF;

  -- one-time signup grant
  IF row.signup_granted_at IS NULL THEN
    IF signup > 0 THEN
      PERFORM public.mon_move(_user, signup, 'free', 'signup', NULL, NULL, 'Welcome credits', NULL, 'signup:' || _user);
      IF exp_days > 0 THEN UPDATE public.user_credits SET free_expires_at = now() + make_interval(days => exp_days) WHERE user_id = _user; END IF;
    END IF;
    UPDATE public.user_credits SET signup_granted_at = now(), last_free_reset_month = mkey WHERE user_id = _user;
  ELSIF monthly > 0 AND row.last_free_reset_month IS DISTINCT FROM mkey THEN
    -- monthly reset: free credits go back to the monthly amount (they do not pile up)
    SELECT * INTO row FROM public.user_credits WHERE user_id = _user;
    PERFORM public.mon_move(_user, monthly - row.free_balance, 'free', 'monthly_reset', NULL, NULL, 'Monthly free credits', NULL, 'reset:' || mkey || ':' || _user);
    UPDATE public.user_credits SET last_free_reset_month = mkey WHERE user_id = _user;
  ELSIF row.last_free_reset_month IS DISTINCT FROM mkey THEN
    UPDATE public.user_credits SET last_free_reset_month = mkey WHERE user_id = _user;
  END IF;

  -- plan credits: granted once per 30-day cycle of the active subscription (renewal = new cycle)
  SELECT m.credits_per_cycle AS credits, um.id AS um_id, um.starts_at INTO plan
    FROM public.user_memberships um JOIN public.memberships m ON m.id = um.membership_id
   WHERE um.user_id = _user AND um.status = 'active' AND um.starts_at <= now() AND um.ends_at > now() AND m.credits_per_cycle > 0
   ORDER BY m.credits_per_cycle DESC LIMIT 1;
  IF FOUND THEN
    cyc := floor(extract(epoch FROM (now() - plan.starts_at)) / (30 * 86400))::integer;
    cyc_key := plan.um_id::text || ':' || cyc;
    IF (SELECT last_plan_cycle FROM public.user_credits WHERE user_id = _user) IS DISTINCT FROM cyc_key THEN
      PERFORM public.mon_move(_user, plan.credits, 'paid', 'plan', NULL, plan.um_id::text, 'Plan credits', NULL, 'plan:' || cyc_key);
      UPDATE public.user_credits SET last_plan_cycle = cyc_key WHERE user_id = _user;
    END IF;
  END IF;

  SELECT * INTO row FROM public.user_credits WHERE user_id = _user;
  RETURN row;
END $$;

-- 8. The one enforcement call: checks master switch, feature switch, limits and credits, then charges, atomically.
CREATE OR REPLACE FUNCTION public.consume_feature(_user uuid, _feature text, _idem text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb := public.mon_settings(); feat public.monetization_features; row public.user_credits; plan record; is_paid boolean := false;
        unlimited boolean := false; cost integer; day_start date := (now() AT TIME ZONE 'Asia/Kolkata')::date; month_start date := date_trunc('month', now() AT TIME ZONE 'Asia/Kolkata')::date;
        used_d integer := 0; used_m integer := 0; lim_d integer; lim_m integer; from_free integer; from_paid integer; usable_free integer;
BEGIN
  IF coalesce((s->>'enabled')::boolean, false) IS NOT TRUE THEN RETURN jsonb_build_object('allowed', true, 'charged', 0, 'reason', 'monetization_off'); END IF;
  SELECT * INTO feat FROM public.monetization_features WHERE feature_key = _feature;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', true, 'charged', 0, 'reason', 'unmetered'); END IF;
  IF NOT feat.enabled THEN RETURN jsonb_build_object('allowed', false, 'reason', 'feature_disabled', 'feature', _feature); END IF;
  IF _idem IS NOT NULL AND EXISTS (SELECT 1 FROM public.credit_ledger WHERE idempotency_key = _idem || ':free' OR idempotency_key = _idem || ':paid' OR idempotency_key = _idem || ':free0') THEN
    RETURN jsonb_build_object('allowed', true, 'charged', 0, 'replay', true);
  END IF;

  row := public.mon_ensure_user(_user);
  SELECT m.unlimited_ai AS unl INTO plan FROM public.user_memberships um JOIN public.memberships m ON m.id = um.membership_id
   WHERE um.user_id = _user AND um.status = 'active' AND um.starts_at <= now() AND um.ends_at > now() ORDER BY m.unlimited_ai DESC LIMIT 1;
  IF FOUND THEN is_paid := true; unlimited := coalesce(plan.unl, false); END IF;

  lim_d := CASE WHEN is_paid THEN feat.paid_daily_limit ELSE feat.free_daily_limit END;
  lim_m := CASE WHEN is_paid THEN feat.paid_monthly_limit ELSE feat.free_monthly_limit END;
  SELECT coalesce(max(used) FILTER (WHERE period = 'day' AND period_start = day_start), 0), coalesce(max(used) FILTER (WHERE period = 'month' AND period_start = month_start), 0)
    INTO used_d, used_m FROM public.feature_usage WHERE user_id = _user AND feature_key = _feature;
  IF lim_d IS NOT NULL AND used_d >= lim_d THEN RETURN jsonb_build_object('allowed', false, 'reason', 'limit_daily', 'feature', _feature, 'limit', lim_d, 'used', used_d); END IF;
  IF lim_m IS NOT NULL AND used_m >= lim_m THEN RETURN jsonb_build_object('allowed', false, 'reason', 'limit_monthly', 'feature', _feature, 'limit', lim_m, 'used', used_m); END IF;

  cost := CASE WHEN unlimited THEN 0 ELSE feat.credit_cost END;
  usable_free := row.free_balance;
  IF cost > usable_free + row.paid_balance THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_credits', 'feature', _feature, 'cost', cost, 'free', row.free_balance, 'paid', row.paid_balance);
  END IF;
  from_free := least(cost, usable_free);
  from_paid := cost - from_free;
  IF from_free > 0 THEN PERFORM public.mon_move(_user, -from_free, 'free', 'usage', _feature, NULL, NULL, NULL, CASE WHEN _idem IS NULL THEN NULL ELSE _idem || ':free' END); END IF;
  IF from_paid > 0 THEN PERFORM public.mon_move(_user, -from_paid, 'paid', 'usage', _feature, NULL, NULL, NULL, CASE WHEN _idem IS NULL THEN NULL ELSE _idem || ':paid' END); END IF;
  INSERT INTO public.feature_usage (user_id, feature_key, period, period_start, used) VALUES (_user, _feature, 'day', day_start, 1), (_user, _feature, 'month', month_start, 1)
    ON CONFLICT (user_id, feature_key, period, period_start) DO UPDATE SET used = public.feature_usage.used + 1;
  SELECT * INTO row FROM public.user_credits WHERE user_id = _user;
  RETURN jsonb_build_object('allowed', true, 'charged', cost, 'free', row.free_balance, 'paid', row.paid_balance);
END $$;

-- Admin / automation helpers (service role only) -------------------------------
CREATE OR REPLACE FUNCTION public.mon_grant(_user uuid, _amount integer, _bucket text, _note text, _by uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.user_credits;
BEGIN
  IF _bucket NOT IN ('free','paid') THEN RAISE EXCEPTION 'bad bucket'; END IF;
  PERFORM public.mon_ensure_user(_user);
  PERFORM public.mon_move(_user, _amount, _bucket, 'admin', NULL, NULL, _note, _by, NULL);
  SELECT * INTO row FROM public.user_credits WHERE user_id = _user;
  RETURN jsonb_build_object('free', row.free_balance, 'paid', row.paid_balance);
END $$;

-- One global action for a whole audience: 'all', 'free' (no active plan) or 'subscribers'.
CREATE OR REPLACE FUNCTION public.mon_grant_audience(_audience text, _amount integer, _bucket text, _note text, _by uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; u record;
BEGIN
  IF _audience NOT IN ('all','free','subscribers') THEN RAISE EXCEPTION 'bad audience'; END IF;
  FOR u IN SELECT p.id FROM public.profiles p WHERE
       _audience = 'all'
    OR (_audience = 'subscribers' AND EXISTS (SELECT 1 FROM public.user_memberships um WHERE um.user_id = p.id AND um.status = 'active' AND um.starts_at <= now() AND um.ends_at > now()))
    OR (_audience = 'free' AND NOT EXISTS (SELECT 1 FROM public.user_memberships um WHERE um.user_id = p.id AND um.status = 'active' AND um.starts_at <= now() AND um.ends_at > now()))
  LOOP
    PERFORM public.mon_ensure_user(u.id);
    PERFORM public.mon_move(u.id, _amount, _bucket, 'admin', NULL, NULL, _note, _by, NULL);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.claim_offer(_user uuid, _code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.monetization_offers; n integer;
BEGIN
  SELECT * INTO o FROM public.monetization_offers WHERE lower(code) = lower(trim(_code)) AND active FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF (o.starts_at IS NOT NULL AND now() < o.starts_at) OR (o.ends_at IS NOT NULL AND now() > o.ends_at) THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_active'); END IF;
  IF o.max_redemptions IS NOT NULL AND o.redeemed_count >= o.max_redemptions THEN RETURN jsonb_build_object('ok', false, 'reason', 'sold_out'); END IF;
  INSERT INTO public.offer_redemptions (offer_id, user_id) VALUES (o.id, _user) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed'); END IF;
  UPDATE public.monetization_offers SET redeemed_count = redeemed_count + 1 WHERE id = o.id;
  PERFORM public.mon_ensure_user(_user);
  IF o.bonus_credits > 0 THEN PERFORM public.mon_move(_user, o.bonus_credits, 'paid', 'offer', NULL, o.id::text, o.title, NULL, 'offer:' || o.id || ':' || _user); END IF;
  RETURN jsonb_build_object('ok', true, 'credits', o.bonus_credits, 'title', o.title);
END $$;

-- Cron-safe cleanup: expire memberships and stale free credits. (Everything is also enforced lazily on use.)
CREATE OR REPLACE FUNCTION public.monetization_maintenance() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE expired_plans integer; expired_credits integer := 0; u record;
BEGIN
  UPDATE public.user_memberships SET status = 'expired' WHERE status = 'active' AND ends_at <= now();
  GET DIAGNOSTICS expired_plans = ROW_COUNT;
  FOR u IN SELECT user_id FROM public.user_credits WHERE free_expires_at IS NOT NULL AND free_expires_at <= now() LOOP
    PERFORM public.mon_ensure_user(u.user_id); expired_credits := expired_credits + 1;
  END LOOP;
  RETURN jsonb_build_object('expired_memberships', expired_plans, 'expired_credit_accounts', expired_credits);
END $$;

-- New accounts get their signup grant automatically; a failure here must never block sign-up.
CREATE OR REPLACE FUNCTION public.mon_on_profile_created() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN PERFORM public.mon_ensure_user(NEW.id); EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS mon_profile_created ON public.profiles;
CREATE TRIGGER mon_profile_created AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.mon_on_profile_created();

-- Only the server (service role) may run the money-like functions.
REVOKE ALL ON FUNCTION public.mon_move(uuid,integer,text,text,text,text,text,uuid,text), public.mon_ensure_user(uuid), public.consume_feature(uuid,text,text),
  public.mon_grant(uuid,integer,text,text,uuid), public.mon_grant_audience(text,integer,text,text,uuid), public.claim_offer(uuid,text), public.monetization_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mon_move(uuid,integer,text,text,text,text,text,uuid,text), public.mon_ensure_user(uuid), public.consume_feature(uuid,text,text),
  public.mon_grant(uuid,integer,text,text,uuid), public.mon_grant_audience(text,integer,text,text,uuid), public.claim_offer(uuid,text), public.monetization_maintenance() TO service_role;
