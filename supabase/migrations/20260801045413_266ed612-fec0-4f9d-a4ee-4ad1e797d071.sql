-- PROFILES: social fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- READING PASSAGES
CREATE TABLE public.reading_passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  passage TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  reading_seconds INTEGER NOT NULL DEFAULT 60,
  quiz_seconds INTEGER NOT NULL DEFAULT 300,
  num_questions INTEGER NOT NULL DEFAULT 5,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  marks_per_question NUMERIC NOT NULL DEFAULT 1,
  negative_marks NUMERIC NOT NULL DEFAULT 0,
  keep_passage_visible BOOLEAN NOT NULL DEFAULT false,
  shuffle_questions BOOLEAN NOT NULL DEFAULT false,
  shuffle_options BOOLEAN NOT NULL DEFAULT false,
  show_explanations BOOLEAN NOT NULL DEFAULT true,
  entry_fee NUMERIC NOT NULL DEFAULT 0,
  prize_pool NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reading_passages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_passages TO authenticated;
GRANT ALL ON public.reading_passages TO service_role;
ALTER TABLE public.reading_passages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reading_passages_public_read" ON public.reading_passages
  FOR SELECT USING (active = true);
CREATE POLICY "reading_passages_admin_read" ON public.reading_passages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reading_passages_admin_write" ON public.reading_passages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_reading_passages_updated BEFORE UPDATE ON public.reading_passages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- READING QUESTIONS
CREATE TABLE public.reading_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passage_id UUID NOT NULL REFERENCES public.reading_passages(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_index INTEGER NOT NULL DEFAULT 0,
  explanation TEXT,
  marks NUMERIC,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reading_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reading_questions TO authenticated;
GRANT ALL ON public.reading_questions TO service_role;
ALTER TABLE public.reading_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reading_questions_public_read" ON public.reading_questions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.reading_passages p WHERE p.id = passage_id AND p.active = true));
CREATE POLICY "reading_questions_admin_read" ON public.reading_questions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reading_questions_admin_write" ON public.reading_questions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_reading_questions_updated BEFORE UPDATE ON public.reading_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_reading_questions_passage ON public.reading_questions(passage_id, sort_order);

-- READING ATTEMPTS
CREATE TABLE public.reading_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  passage_id UUID NOT NULL REFERENCES public.reading_passages(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  question_order JSONB,
  score NUMERIC NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  unanswered_count INTEGER NOT NULL DEFAULT 0,
  accuracy NUMERIC NOT NULL DEFAULT 0,
  reading_completed BOOLEAN NOT NULL DEFAULT false,
  reading_seconds_spent INTEGER NOT NULL DEFAULT 0,
  quiz_seconds_spent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'reading',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.reading_attempts TO authenticated;
GRANT ALL ON public.reading_attempts TO service_role;
ALTER TABLE public.reading_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reading_attempts_own_read" ON public.reading_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reading_attempts_own_insert" ON public.reading_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reading_attempts_own_update" ON public.reading_attempts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_reading_attempts_updated BEFORE UPDATE ON public.reading_attempts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_reading_attempts_user ON public.reading_attempts(user_id, passage_id);

-- SCORING RPC: server-side scoring so correct answers never need to reach the client
CREATE OR REPLACE FUNCTION public.submit_reading_attempt(_attempt_id uuid, _answers jsonb, _quiz_seconds_spent integer)
RETURNS TABLE(score numeric, correct_count integer, wrong_count integer, unanswered_count integer, accuracy numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_att RECORD;
  v_p RECORD;
  v_correct int := 0;
  v_wrong int := 0;
  v_unans int := 0;
  v_score numeric := 0;
  v_ids uuid[];
  q RECORD;
  ans int;
  i int := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO v_att FROM public.reading_attempts WHERE id = _attempt_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_att.status = 'completed' THEN RAISE EXCEPTION 'Already submitted'; END IF;
  SELECT * INTO v_p FROM public.reading_passages WHERE id = v_att.passage_id;

  IF v_att.question_order IS NOT NULL AND jsonb_typeof(v_att.question_order) = 'array' THEN
    SELECT array_agg((value #>> '{}')::uuid ORDER BY ord)
      INTO v_ids FROM jsonb_array_elements(v_att.question_order) WITH ORDINALITY t(value, ord);
  ELSE
    SELECT array_agg(id ORDER BY sort_order, created_at)
      INTO v_ids FROM public.reading_questions WHERE passage_id = v_att.passage_id;
  END IF;

  IF v_ids IS NULL THEN RAISE EXCEPTION 'No questions'; END IF;

  FOREACH i IN ARRAY (SELECT array_agg(g) FROM generate_series(1, array_length(v_ids,1)) g) LOOP
    SELECT * INTO q FROM public.reading_questions WHERE id = v_ids[i];
    BEGIN
      ans := NULLIF(_answers->>(i-1), 'null')::int;
    EXCEPTION WHEN others THEN ans := NULL;
    END;
    IF ans IS NULL OR ans < 0 THEN
      v_unans := v_unans + 1;
    ELSIF q.id IS NOT NULL AND ans = q.correct_index THEN
      v_correct := v_correct + 1;
      v_score := v_score + coalesce(q.marks, v_p.marks_per_question, 1);
    ELSE
      v_wrong := v_wrong + 1;
      v_score := v_score - coalesce(v_p.negative_marks, 0);
    END IF;
  END LOOP;

  UPDATE public.reading_attempts SET
    answers = _answers,
    score = v_score,
    correct_count = v_correct,
    wrong_count = v_wrong,
    unanswered_count = v_unans,
    accuracy = CASE WHEN array_length(v_ids,1) > 0 THEN round((v_correct::numeric / array_length(v_ids,1)) * 100, 2) ELSE 0 END,
    quiz_seconds_spent = coalesce(_quiz_seconds_spent, 0),
    status = 'completed',
    submitted_at = now()
  WHERE id = _attempt_id;

  PERFORM public.grant_xp(v_user, 15 + (v_correct * 5), 'reading_quiz', _attempt_id, '{}'::jsonb);

  RETURN QUERY SELECT v_score, v_correct, v_wrong, v_unans,
    CASE WHEN array_length(v_ids,1) > 0 THEN round((v_correct::numeric / array_length(v_ids,1)) * 100, 2) ELSE 0 END;
END; $$;