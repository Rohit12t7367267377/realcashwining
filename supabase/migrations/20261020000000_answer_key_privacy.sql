-- Answer-key privacy for reading quizzes.
-- (public.questions was already restricted by 20260816061434.)
-- Students must not be able to read correct_index / explanation before submitting.

REVOKE SELECT ON public.reading_questions FROM anon, authenticated;
GRANT SELECT (id, passage_id, question, options, marks, sort_order, created_at, updated_at)
  ON public.reading_questions TO anon, authenticated;
GRANT ALL ON public.reading_questions TO service_role;

-- Review RPC: answers are revealed only for the caller's own, already-scored attempt.
CREATE OR REPLACE FUNCTION public.get_reading_review(_attempt_id uuid)
RETURNS TABLE(question_id uuid, correct_index integer, explanation text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_att RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO v_att FROM public.reading_attempts WHERE id = _attempt_id AND user_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF v_att.status <> 'completed' OR v_att.submitted_at IS NULL THEN
    RAISE EXCEPTION 'Submit the quiz to see answers';
  END IF;
  RETURN QUERY
    SELECT q.id, q.correct_index, q.explanation
    FROM public.reading_questions q
    WHERE q.passage_id = v_att.passage_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_reading_review(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reading_review(uuid) TO authenticated, service_role;

-- Students could previously flip their own attempt to "completed" with a direct UPDATE and
-- then read the review. Only the SECURITY DEFINER scorer (running as the function owner)
-- may change result columns.
CREATE OR REPLACE FUNCTION public.guard_reading_attempt_result()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.score := OLD.score;
    NEW.correct_count := OLD.correct_count;
    NEW.wrong_count := OLD.wrong_count;
    NEW.unanswered_count := OLD.unanswered_count;
    NEW.accuracy := OLD.accuracy;
    NEW.submitted_at := OLD.submitted_at;
    NEW.answers := OLD.answers;
    NEW.quiz_seconds_spent := OLD.quiz_seconds_spent;
    IF OLD.status = 'completed' OR NEW.status = 'completed' THEN NEW.status := OLD.status; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_reading_attempt_guard ON public.reading_attempts;
CREATE TRIGGER trg_reading_attempt_guard BEFORE UPDATE ON public.reading_attempts
  FOR EACH ROW EXECUTE FUNCTION public.guard_reading_attempt_result();
