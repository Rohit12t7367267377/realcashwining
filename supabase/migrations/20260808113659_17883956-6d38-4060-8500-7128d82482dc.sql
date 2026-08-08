-- 1. Premium feature catalogue
CREATE TABLE public.premium_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'sparkles',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.premium_features TO anon;
GRANT SELECT ON public.premium_features TO authenticated;
GRANT ALL ON public.premium_features TO service_role;
ALTER TABLE public.premium_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view premium features" ON public.premium_features FOR SELECT USING (true);
CREATE TRIGGER trg_premium_features_updated BEFORE UPDATE ON public.premium_features
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Plan <-> feature mapping
CREATE TABLE public.membership_features (
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.premium_features(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id, feature_id)
);
GRANT SELECT ON public.membership_features TO anon;
GRANT SELECT ON public.membership_features TO authenticated;
GRANT ALL ON public.membership_features TO service_role;
ALTER TABLE public.membership_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view plan features" ON public.membership_features FOR SELECT USING (true);

-- 3. Payments ledger
CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'razorpay',
  order_id text,
  payment_id text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscription_payments_order_id_key ON public.subscription_payments(order_id) WHERE order_id IS NOT NULL;
GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own subscription payments" ON public.subscription_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all subscription payments" ON public.subscription_payments
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_subscription_payments_updated BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Plan extras
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS highlight text,
  ADD COLUMN IF NOT EXISTS daily_quiz_limit integer,
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all';

-- 5. Subscription extras
ALTER TABLE public.user_memberships
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.subscription_payments(id) ON DELETE SET NULL;

-- 6. Seed benefit catalogue
INSERT INTO public.premium_features (code, name, description, icon, sort_order) VALUES
  ('unlimited_ai',       'Unlimited Guru.AI',        'No daily cap on AI doubts, tutoring and recommendations.', 'sparkles', 1),
  ('creator_mode',       'Creator Mode',             'Unlock creator tools, analytics and monetisation track.',   'video', 2),
  ('premium_quizzes',    'Premium Quizzes',          'Access members-only contests and reading sets.',            'crown', 3),
  ('weekly_leaderboard', 'Weekly Skill Leaderboard', 'Compete on the members-only weekly skill board.',           'trophy', 4),
  ('prize_eligibility',  'Prize Eligibility',        'Eligible for weekly, monthly and yearly prize pools.',      'gift', 5),
  ('higher_limits',      'Higher Daily Quiz Limit',  'Play many more quizzes each day.',                          'gauge', 6),
  ('ad_free',            'Ad-Free Experience',       'No promotional banners or interstitials.',                  'shield', 7),
  ('premium_badge',      'Premium Badge',            'A verified premium badge on your profile and posts.',       'badge-check', 8),
  ('exclusive_events',   'Exclusive Events',         'Entry to seasonal and invite-only events.',                 'calendar', 9),
  ('early_access',       'Early Access',             'Try new features and contests before everyone else.',       'rocket', 10),
  ('referral_boost',     'Referral Boost',           'Earn extra rewards on every successful referral.',          'users', 11),
  ('faster_support',     'Priority Support',         'Your tickets are answered first.',                          'life-buoy', 12),
  ('wallet_rewards',     'Wallet Rewards',           'Bonus wallet credits on joining and renewal.',              'wallet', 13)
ON CONFLICT (code) DO NOTHING;