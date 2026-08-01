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
  v_total int;
  v_acc numeric;
  q RECORD;
  ans int;
  i int;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO v_att FROM public.reading_attempts WHERE id = _attempt_id AND user_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_att.status = 'completed' THEN RAISE EXCEPTION 'Already submitted'; END IF;
  SELECT * INTO v_p FROM public.reading_passages WHERE id = v_att.passage_id;

  IF v_att.question_order IS NOT NULL AND jsonb_typeof(v_att.question_order) = 'array'
     AND jsonb_array_length(v_att.question_order) > 0 THEN
    SELECT array_agg((value #>> '{}')::uuid ORDER BY ord)
      INTO v_ids FROM jsonb_array_elements(v_att.question_order) WITH ORDINALITY t(value, ord);
  ELSE
    SELECT array_agg(id ORDER BY sort_order, created_at)
      INTO v_ids FROM public.reading_questions WHERE passage_id = v_att.passage_id;
  END IF;

  IF v_ids IS NULL THEN RAISE EXCEPTION 'No questions'; END IF;
  v_total := array_length(v_ids, 1);

  FOR i IN 1 .. v_total LOOP
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

  v_acc := CASE WHEN v_total > 0 THEN round((v_correct::numeric / v_total) * 100, 2) ELSE 0 END;

  UPDATE public.reading_attempts SET
    answers = _answers,
    score = v_score,
    correct_count = v_correct,
    wrong_count = v_wrong,
    unanswered_count = v_unans,
    accuracy = v_acc,
    quiz_seconds_spent = coalesce(_quiz_seconds_spent, 0),
    status = 'completed',
    submitted_at = now()
  WHERE id = _attempt_id;

  PERFORM public.grant_xp(v_user, 15 + (v_correct * 5), 'reading_quiz', _attempt_id, '{}'::jsonb);

  RETURN QUERY SELECT v_score, v_correct, v_wrong, v_unans, v_acc;
END; $$;

REVOKE EXECUTE ON FUNCTION public.submit_reading_attempt(uuid, jsonb, integer) FROM anon;