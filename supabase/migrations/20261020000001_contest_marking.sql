-- Per-contest marking (exam-style +/-). NULL keeps the global app_settings behaviour, so every
-- existing contest scores exactly as before.
ALTER TABLE public.contests ADD COLUMN IF NOT EXISTS marks_correct numeric;
ALTER TABLE public.contests ADD COLUMN IF NOT EXISTS marks_wrong numeric;
ALTER TABLE public.contests DROP CONSTRAINT IF EXISTS contests_marks_sane;
ALTER TABLE public.contests ADD CONSTRAINT contests_marks_sane CHECK (
  (marks_correct IS NULL OR (marks_correct > 0 AND marks_correct <= 100)) AND
  (marks_wrong IS NULL OR (marks_wrong <= 0 AND marks_wrong >= -100))
);

CREATE OR REPLACE FUNCTION public.auto_score_contest(_contest_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat uuid;
  v_num int;
  v_mc numeric;
  v_mw numeric;
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
  SELECT category_id, num_questions, marks_correct, marks_wrong INTO v_cat, v_num, v_mc, v_mw
    FROM public.contests WHERE id = _contest_id;
  SELECT coalesce((value)::text::numeric, 1) INTO v_correct_pts FROM public.app_settings WHERE key='correct_points';
  IF v_correct_pts IS NULL THEN v_correct_pts := 1; END IF;
  SELECT coalesce((value)::text::numeric, 0) INTO v_wrong_pts FROM public.app_settings WHERE key='wrong_points';
  IF v_wrong_pts IS NULL THEN v_wrong_pts := 0; END IF;
  v_correct_pts := coalesce(v_mc, v_correct_pts);
  v_wrong_pts := coalesce(v_mw, v_wrong_pts);

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
