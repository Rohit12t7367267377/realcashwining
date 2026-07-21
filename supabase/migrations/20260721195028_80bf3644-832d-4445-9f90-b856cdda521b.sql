
-- 1. user_xp
CREATE TABLE public.user_xp (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  boxes_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_xp TO authenticated, anon;
GRANT ALL ON public.user_xp TO service_role;
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_xp public read" ON public.user_xp FOR SELECT USING (true);

-- 2. xp_events (audit log)
CREATE TABLE public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  amount INTEGER NOT NULL,
  ref_id UUID,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX xp_events_user_idx ON public.xp_events(user_id, created_at DESC);
GRANT SELECT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_events own read" ON public.xp_events FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- 3. missions
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('daily','weekly','monthly')),
  goal_type TEXT NOT NULL CHECK (goal_type IN ('play_quiz','win_contest','correct_answers','xp_gain','deposit')),
  goal_value INTEGER NOT NULL DEFAULT 1,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  reward_coins NUMERIC NOT NULL DEFAULT 0,
  reward_box_tier TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.missions TO authenticated, anon;
GRANT ALL ON public.missions TO service_role;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missions public read" ON public.missions FOR SELECT USING (true);

-- 4. user_missions
CREATE TABLE public.user_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id, period_key)
);
GRANT SELECT, INSERT, UPDATE ON public.user_missions TO authenticated;
GRANT ALL ON public.user_missions TO service_role;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_missions own" ON public.user_missions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. seasonal_events
CREATE TABLE public.seasonal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reward_pool NUMERIC NOT NULL DEFAULT 0,
  bonus_xp_multiplier NUMERIC NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seasonal_events TO authenticated, anon;
GRANT ALL ON public.seasonal_events TO service_role;
ALTER TABLE public.seasonal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events public read" ON public.seasonal_events FOR SELECT USING (true);

-- 6. reward_boxes
CREATE TABLE public.reward_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'common' CHECK (tier IN ('common','rare','epic','legendary')),
  source TEXT NOT NULL,
  opened BOOLEAN NOT NULL DEFAULT false,
  reward_xp INTEGER,
  reward_coins NUMERIC,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reward_boxes_user_idx ON public.reward_boxes(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.reward_boxes TO authenticated;
GRANT ALL ON public.reward_boxes TO service_role;
ALTER TABLE public.reward_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boxes own" ON public.reward_boxes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "boxes own update" ON public.reward_boxes FOR UPDATE USING (auth.uid() = user_id);

-- Helper: XP -> Level
CREATE OR REPLACE FUNCTION public.xp_to_level(_xp INTEGER)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(1, FLOOR(SQRT(GREATEST(_xp,0)::numeric / 100))::int + 1)
$$;

-- Grant XP function (atomic)
CREATE OR REPLACE FUNCTION public.grant_xp(_user_id UUID, _amount INTEGER, _source TEXT, _ref UUID DEFAULT NULL, _meta JSONB DEFAULT '{}'::jsonb)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
BEGIN
  INSERT INTO public.user_xp(user_id, xp, level) VALUES (_user_id, 0, 1)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT level INTO v_old_level FROM public.user_xp WHERE user_id = _user_id FOR UPDATE;
  UPDATE public.user_xp
     SET xp = xp + _amount,
         level = public.xp_to_level(xp + _amount),
         updated_at = now()
   WHERE user_id = _user_id
   RETURNING xp, level INTO v_new_xp, v_new_level;

  INSERT INTO public.xp_events(user_id, source, amount, ref_id, meta)
    VALUES (_user_id, _source, _amount, _ref, coalesce(_meta,'{}'::jsonb));

  IF v_new_level > v_old_level THEN
    INSERT INTO public.reward_boxes(user_id, tier, source)
    VALUES (
      _user_id,
      CASE WHEN v_new_level % 10 = 0 THEN 'legendary'
           WHEN v_new_level % 5 = 0 THEN 'epic'
           WHEN v_new_level % 2 = 0 THEN 'rare'
           ELSE 'common' END,
      'level_up:' || v_new_level
    );
    UPDATE public.user_xp SET boxes_earned = boxes_earned + 1 WHERE user_id = _user_id;
  END IF;

  RETURN QUERY SELECT v_new_xp, v_new_level, v_new_level > v_old_level;
END; $$;

-- Trigger: when contest_attempt becomes completed, award base XP
CREATE OR REPLACE FUNCTION public.award_xp_on_attempt_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_xp INTEGER;
  v_correct INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    v_correct := coalesce((NEW.answers->>'_correct')::int, 0);
    v_xp := 20 + (v_correct * 5);
    PERFORM public.grant_xp(NEW.user_id, v_xp, 'quiz_complete', NEW.id, jsonb_build_object('contest_id', NEW.contest_id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_award_xp_on_attempt ON public.contest_attempts;
CREATE TRIGGER trg_award_xp_on_attempt
  AFTER UPDATE ON public.contest_attempts
  FOR EACH ROW EXECUTE FUNCTION public.award_xp_on_attempt_complete();

-- Claim mission function
CREATE OR REPLACE FUNCTION public.claim_mission(_user_mission_id UUID)
RETURNS TABLE(reward_xp INTEGER, reward_coins NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_um RECORD;
  v_m RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO v_um FROM public.user_missions WHERE id = _user_mission_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mission progress not found'; END IF;
  IF v_um.claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Already claimed'; END IF;
  IF v_um.completed_at IS NULL THEN RAISE EXCEPTION 'Not completed yet'; END IF;
  SELECT * INTO v_m FROM public.missions WHERE id = v_um.mission_id;

  UPDATE public.user_missions SET claimed_at = now() WHERE id = _user_mission_id;
  IF v_m.reward_xp > 0 THEN
    PERFORM public.grant_xp(v_user, v_m.reward_xp, 'mission:' || v_m.code, v_m.id, '{}'::jsonb);
  END IF;
  IF v_m.reward_coins > 0 THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + v_m.reward_coins WHERE id = v_user;
    INSERT INTO public.transactions(user_id, type, amount, note)
      VALUES (v_user, 'credit', v_m.reward_coins, 'Mission: ' || v_m.title);
  END IF;
  IF v_m.reward_box_tier IS NOT NULL THEN
    INSERT INTO public.reward_boxes(user_id, tier, source) VALUES (v_user, v_m.reward_box_tier, 'mission:' || v_m.code);
  END IF;
  RETURN QUERY SELECT v_m.reward_xp, v_m.reward_coins;
END; $$;

-- Open reward box
CREATE OR REPLACE FUNCTION public.open_reward_box(_box_id UUID)
RETURNS TABLE(reward_xp INTEGER, reward_coins NUMERIC, tier TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_box RECORD;
  v_xp INTEGER;
  v_coins NUMERIC;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO v_box FROM public.reward_boxes WHERE id = _box_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Box not found'; END IF;
  IF v_box.opened THEN RAISE EXCEPTION 'Already opened'; END IF;

  -- Roll rewards based on tier
  v_xp := CASE v_box.tier
    WHEN 'common'    THEN 20 + (random()*30)::int
    WHEN 'rare'      THEN 60 + (random()*60)::int
    WHEN 'epic'      THEN 150 + (random()*150)::int
    WHEN 'legendary' THEN 400 + (random()*400)::int
  END;
  v_coins := CASE v_box.tier
    WHEN 'common'    THEN round((random()*5)::numeric, 2)
    WHEN 'rare'      THEN round((5 + random()*15)::numeric, 2)
    WHEN 'epic'      THEN round((20 + random()*30)::numeric, 2)
    WHEN 'legendary' THEN round((50 + random()*100)::numeric, 2)
  END;

  UPDATE public.reward_boxes
     SET opened = true, opened_at = now(), reward_xp = v_xp, reward_coins = v_coins
   WHERE id = _box_id;

  PERFORM public.grant_xp(v_user, v_xp, 'reward_box:' || v_box.tier, v_box.id, '{}'::jsonb);
  IF v_coins > 0 THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + v_coins WHERE id = v_user;
    INSERT INTO public.transactions(user_id, type, amount, note)
      VALUES (v_user, 'credit', v_coins, 'Reward Box (' || v_box.tier || ')');
  END IF;

  RETURN QUERY SELECT v_xp, v_coins, v_box.tier;
END; $$;

-- Progress helper: recompute a user's missions in current period windows
CREATE OR REPLACE FUNCTION public.refresh_user_missions(_user_id UUID DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := coalesce(_user_id, auth.uid());
  v_updated INTEGER := 0;
  m RECORD;
  v_period TEXT;
  v_win_start TIMESTAMPTZ;
  v_win_end TIMESTAMPTZ;
  v_progress INTEGER;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  FOR m IN SELECT * FROM public.missions WHERE active = true LOOP
    IF m.kind = 'daily' THEN
      v_period := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
      v_win_start := date_trunc('day', now());
      v_win_end := v_win_start + interval '1 day';
    ELSIF m.kind = 'weekly' THEN
      v_period := to_char(now() AT TIME ZONE 'UTC', 'IYYY-"W"IW');
      v_win_start := date_trunc('week', now());
      v_win_end := v_win_start + interval '7 days';
    ELSE
      v_period := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
      v_win_start := date_trunc('month', now());
      v_win_end := v_win_start + interval '1 month';
    END IF;

    IF m.goal_type = 'play_quiz' THEN
      SELECT count(*) INTO v_progress FROM public.contest_attempts
       WHERE user_id = v_user AND status = 'completed' AND submitted_at >= v_win_start AND submitted_at < v_win_end;
    ELSIF m.goal_type = 'win_contest' THEN
      SELECT count(*) INTO v_progress FROM public.contest_attempts
       WHERE user_id = v_user AND is_winner = true AND submitted_at >= v_win_start AND submitted_at < v_win_end;
    ELSIF m.goal_type = 'correct_answers' THEN
      SELECT coalesce(sum((answers->>'_correct')::int),0) INTO v_progress FROM public.contest_attempts
       WHERE user_id = v_user AND status='completed' AND submitted_at >= v_win_start AND submitted_at < v_win_end;
    ELSIF m.goal_type = 'xp_gain' THEN
      SELECT coalesce(sum(amount),0) INTO v_progress FROM public.xp_events
       WHERE user_id = v_user AND created_at >= v_win_start AND created_at < v_win_end;
    ELSIF m.goal_type = 'deposit' THEN
      SELECT coalesce(sum(amount),0)::int INTO v_progress FROM public.deposit_requests
       WHERE user_id = v_user AND status='approved' AND created_at >= v_win_start AND created_at < v_win_end;
    ELSE
      v_progress := 0;
    END IF;

    INSERT INTO public.user_missions(user_id, mission_id, period_key, progress, completed_at)
    VALUES (v_user, m.id, v_period, v_progress,
            CASE WHEN v_progress >= m.goal_value THEN now() ELSE NULL END)
    ON CONFLICT (user_id, mission_id, period_key) DO UPDATE
      SET progress = EXCLUDED.progress,
          completed_at = CASE
            WHEN public.user_missions.completed_at IS NOT NULL THEN public.user_missions.completed_at
            WHEN EXCLUDED.progress >= (SELECT goal_value FROM public.missions WHERE id = EXCLUDED.mission_id) THEN now()
            ELSE NULL END,
          updated_at = now();
    v_updated := v_updated + 1;
  END LOOP;
  RETURN v_updated;
END; $$;

-- Updated_at triggers
CREATE TRIGGER trg_missions_updated BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.seasonal_events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_user_xp_updated BEFORE UPDATE ON public.user_xp FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_user_missions_updated BEFORE UPDATE ON public.user_missions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed a few default missions so the feature works out of the box
INSERT INTO public.missions(code,title,description,kind,goal_type,goal_value,reward_xp,reward_coins,sort_order) VALUES
 ('daily_play_1','Warm Up','Complete 1 quiz today','daily','play_quiz',1,30,2,1),
 ('daily_correct_10','Sharp Shooter','Answer 10 questions correctly today','daily','correct_answers',10,60,5,2),
 ('weekly_play_10','Grinder','Complete 10 quizzes this week','weekly','play_quiz',10,200,25,10),
 ('weekly_win_1','First Blood','Win at least 1 contest this week','weekly','win_contest',1,150,20,11),
 ('monthly_play_50','Champion','Complete 50 quizzes this month','monthly','play_quiz',50,700,100,20)
ON CONFLICT (code) DO NOTHING;
