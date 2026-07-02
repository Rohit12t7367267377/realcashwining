
ALTER TABLE public.contest_attempts
  ADD COLUMN IF NOT EXISTS answers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prize_awarded numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_winner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rank integer;

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS results_status text NOT NULL DEFAULT 'pending';

-- Award prize atomically: credit wallet, mark attempt, log transaction
CREATE OR REPLACE FUNCTION public.admin_declare_contest_result(
  _contest_id uuid,
  _attempt_id uuid,
  _rank integer,
  _prize numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_title text;
BEGIN
  SELECT user_id INTO v_user FROM public.contest_attempts WHERE id = _attempt_id AND contest_id = _contest_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'attempt not found'; END IF;
  SELECT title INTO v_title FROM public.contests WHERE id = _contest_id;

  UPDATE public.contest_attempts
    SET rank = _rank, prize_awarded = _prize, is_winner = (_prize > 0), status = 'completed'
    WHERE id = _attempt_id;

  IF _prize > 0 THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + _prize WHERE id = v_user;
    INSERT INTO public.transactions (user_id, type, amount, note)
    VALUES (v_user, 'credit', _prize, 'Prize: ' || coalesce(v_title, 'Contest') || ' (Rank ' || _rank || ')');
  END IF;
END;
$$;
