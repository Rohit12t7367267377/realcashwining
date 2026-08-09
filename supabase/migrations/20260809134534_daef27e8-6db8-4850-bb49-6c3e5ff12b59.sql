-- 1. Push tokens
CREATE TABLE public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'web',
  user_agent text,
  enabled boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_tokens_user ON public.push_tokens(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tokens" ON public.push_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read tokens" ON public.push_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_push_tokens_updated BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Campaigns
CREATE TABLE public.push_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  deep_link text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  audience text NOT NULL DEFAULT 'all',
  target_user_ids uuid[] NOT NULL DEFAULT '{}',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  contest_id uuid REFERENCES public.contests(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  event_code text,
  recipients_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_campaigns_status ON public.push_campaigns(status, scheduled_at);
GRANT SELECT ON public.push_campaigns TO authenticated;
GRANT ALL ON public.push_campaigns TO service_role;
ALTER TABLE public.push_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in read sent campaigns" ON public.push_campaigns FOR SELECT TO authenticated
  USING (status = 'sent' OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_push_campaigns_updated BEFORE UPDATE ON public.push_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Deliveries
CREATE TABLE public.push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.push_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_push_deliveries_campaign ON public.push_deliveries(campaign_id);
CREATE INDEX idx_push_deliveries_user ON public.push_deliveries(user_id, created_at DESC);
GRANT SELECT ON public.push_deliveries TO authenticated;
GRANT ALL ON public.push_deliveries TO service_role;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin deliveries" ON public.push_deliveries FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 4. Helper to queue automatic event notifications
CREATE OR REPLACE FUNCTION public.queue_event_notification(
  _event_code text, _title text, _body text, _link text DEFAULT NULL,
  _audience text DEFAULT 'all', _contest_id uuid DEFAULT NULL, _category_id uuid DEFAULT NULL,
  _target_user_ids uuid[] DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_on boolean;
BEGIN
  SELECT coalesce((value)::text::boolean, true) INTO v_on
    FROM public.app_settings WHERE key = 'auto_notifications_enabled';
  IF v_on IS NOT NULL AND v_on = false THEN RETURN NULL; END IF;

  INSERT INTO public.push_campaigns(title, body, deep_link, audience, contest_id, category_id,
                                    target_user_ids, event_code, status, scheduled_at)
  VALUES (_title, _body, _link, _audience, _contest_id, _category_id,
          coalesce(_target_user_ids, '{}'), _event_code, 'queued', now())
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- 5. Automatic triggers
CREATE OR REPLACE FUNCTION public.notify_new_contest()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active THEN
    PERFORM public.queue_event_notification('new_contest', 'New contest: ' || NEW.title,
      'Entry ₹' || NEW.entry_fee || ' · Prize pool ₹' || NEW.prize_pool || '. Join now!',
      '/contest/' || NEW.id, 'all', NEW.id, NEW.category_id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_new_contest AFTER INSERT ON public.contests
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_contest();

CREATE OR REPLACE FUNCTION public.notify_live_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_live AND (TG_OP = 'INSERT' OR OLD.is_live IS DISTINCT FROM true) THEN
    PERFORM public.queue_event_notification('live_match', 'Live now: ' || NEW.home_team || ' vs ' || NEW.away_team,
      'Follow live scores and play the match quiz.', '/live-scores', 'all');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_live_match AFTER INSERT OR UPDATE ON public.live_scores
  FOR EACH ROW EXECUTE FUNCTION public.notify_live_match();

CREATE OR REPLACE FUNCTION public.notify_wallet_credit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type = 'credit' THEN
    PERFORM public.queue_event_notification('wallet_credit', '₹' || NEW.amount || ' credited',
      coalesce(NEW.note, 'Amount added to your wallet.'), '/wallet', 'selected', NULL, NULL,
      ARRAY[NEW.user_id]);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notify_wallet_credit AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_wallet_credit();

-- 6. Phone sign-ups: keep profile phone in sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  is_first boolean;
  bonus numeric := 0;
  v_phone text;
begin
  select coalesce((value)::text::numeric, 0) into bonus from public.app_settings where key = 'new_user_bonus';
  v_phone := coalesce(new.phone, new.raw_user_meta_data->>'phone', '');
  insert into public.profiles (id, full_name, phone, referral_code, wallet_balance, phone_verified)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    v_phone,
    'CWL' || upper(substr(md5(new.id::text), 1, 6)),
    coalesce(bonus, 0),
    new.phone_confirmed_at is not null
  );
  if coalesce(bonus, 0) > 0 then
    insert into public.transactions (user_id, type, amount, note)
    values (new.id, 'credit', bonus, 'Welcome bonus');
  end if;
  select not exists (select 1 from public.user_roles where role = 'admin') into is_first;
  insert into public.user_roles (user_id, role) values (new.id, case when is_first then 'admin'::app_role else 'user'::app_role end);
  return new;
end;
$$;