
CREATE TABLE IF NOT EXISTS public.live_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport text NOT NULL DEFAULT 'Cricket',
  league text,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_score text NOT NULL DEFAULT '-',
  away_score text NOT NULL DEFAULT '-',
  status text NOT NULL DEFAULT 'Live',
  match_time text,
  is_live boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.live_scores TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.live_scores TO authenticated;
GRANT ALL ON public.live_scores TO service_role;

ALTER TABLE public.live_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_scores public read" ON public.live_scores;
CREATE POLICY "live_scores public read" ON public.live_scores
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "live_scores admin write" ON public.live_scores;
CREATE POLICY "live_scores admin write" ON public.live_scores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_live_scores_updated_at ON public.live_scores;
CREATE TRIGGER trg_live_scores_updated_at BEFORE UPDATE ON public.live_scores
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Atomic join contest: creates attempt + debits fee once. Returns attempt id.
CREATE OR REPLACE FUNCTION public.join_contest(_contest_id uuid)
RETURNS TABLE(attempt_id uuid, charged numeric, already boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_fee numeric;
  v_active boolean;
  v_status text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_title text;
  v_bal numeric;
  v_existing uuid;
  v_new uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  SELECT entry_fee, active, results_status, starts_at, ends_at, title
    INTO v_fee, v_active, v_status, v_starts, v_ends, v_title
  FROM public.contests WHERE id = _contest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contest not found'; END IF;
  IF NOT v_active THEN RAISE EXCEPTION 'Contest is not active yet'; END IF;
  IF v_status = 'declared' THEN RAISE EXCEPTION 'Results already declared'; END IF;
  IF v_starts IS NOT NULL AND v_starts > now() THEN RAISE EXCEPTION 'Contest has not started yet'; END IF;
  IF v_ends IS NOT NULL AND v_ends < now() THEN RAISE EXCEPTION 'Contest has ended'; END IF;

  SELECT id INTO v_existing FROM public.contest_attempts
    WHERE contest_id = _contest_id AND user_id = v_user LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, 0::numeric, true;
    RETURN;
  END IF;

  IF coalesce(v_fee,0) > 0 THEN
    SELECT wallet_balance INTO v_bal FROM public.profiles WHERE id = v_user FOR UPDATE;
    IF v_bal < v_fee THEN RAISE EXCEPTION 'Insufficient wallet balance. Please add money first.'; END IF;
    UPDATE public.profiles SET wallet_balance = v_bal - v_fee WHERE id = v_user;
    INSERT INTO public.transactions(user_id, type, amount, note)
      VALUES (v_user, 'debit', v_fee, 'Entry: ' || coalesce(v_title,'Contest'));
  END IF;

  INSERT INTO public.contest_attempts(user_id, contest_id, status)
    VALUES (v_user, _contest_id, 'in_progress')
    RETURNING id INTO v_new;

  RETURN QUERY SELECT v_new, coalesce(v_fee,0), false;
END; $$;

REVOKE ALL ON FUNCTION public.join_contest(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.join_contest(uuid) TO authenticated, service_role;

-- Auto-score attempts using questions.correct_index and configured points
CREATE OR REPLACE FUNCTION public.auto_score_contest(_contest_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat uuid;
  v_num int;
  v_correct_pts numeric;
  v_wrong_pts numeric;
  v_updated int := 0;
  r record;
  v_correct int;
  v_wrong int;
  v_unanswered int;
  v_score numeric;
  v_correct_arr int[];
  ans int;
BEGIN
  SELECT category_id, num_questions INTO v_cat, v_num FROM public.contests WHERE id = _contest_id;
  SELECT coalesce((value)::text::numeric, 1) INTO v_correct_pts FROM public.app_settings WHERE key='correct_points';
  IF v_correct_pts IS NULL THEN v_correct_pts := 1; END IF;
  SELECT coalesce((value)::text::numeric, 0) INTO v_wrong_pts FROM public.app_settings WHERE key='wrong_points';
  IF v_wrong_pts IS NULL THEN v_wrong_pts := 0; END IF;

  SELECT array_agg(correct_index ORDER BY created_at)
    INTO v_correct_arr
  FROM (SELECT correct_index, created_at FROM public.questions
        WHERE category_id = v_cat ORDER BY created_at LIMIT v_num) q;

  IF v_correct_arr IS NULL THEN RETURN 0; END IF;

  FOR r IN SELECT id, answers FROM public.contest_attempts WHERE contest_id = _contest_id LOOP
    v_correct := 0; v_wrong := 0; v_unanswered := 0;
    IF r.answers IS NOT NULL AND jsonb_typeof(r.answers) = 'array' THEN
      FOR i IN 1 .. array_length(v_correct_arr,1) LOOP
        BEGIN
          ans := NULLIF(r.answers->>(i-1), 'null')::int;
          IF ans IS NULL OR ans < 0 THEN v_unanswered := v_unanswered + 1;
          ELSIF ans = v_correct_arr[i] THEN v_correct := v_correct + 1;
          ELSE v_wrong := v_wrong + 1;
          END IF;
        EXCEPTION WHEN others THEN v_unanswered := v_unanswered + 1;
        END;
      END LOOP;
    ELSE
      v_unanswered := array_length(v_correct_arr,1);
    END IF;
    v_score := (v_correct * v_correct_pts) + (v_wrong * v_wrong_pts);
    UPDATE public.contest_attempts
       SET score = v_score,
           answers = coalesce(r.answers, '[]'::jsonb) || jsonb_build_object(
             '_correct', v_correct, '_wrong', v_wrong, '_unanswered', v_unanswered
           )
     WHERE id = r.id;
    v_updated := v_updated + 1;
  END LOOP;
  RETURN v_updated;
END; $$;

REVOKE ALL ON FUNCTION public.auto_score_contest(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.auto_score_contest(uuid) TO service_role;
