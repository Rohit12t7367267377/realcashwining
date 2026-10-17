-- Free-to-play sports prediction engine (virtual points only).
-- Additive: creates new pred_* tables and functions; does not touch the
-- existing real-money wallet, contests or transactions.

CREATE SCHEMA IF NOT EXISTS private;

-- ---------------------------------------------------------------------------
-- Configuration: sports, categories, templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pred_sports (
  key text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  provider_supported boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.pred_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  sport text NOT NULL DEFAULT 'any',
  enabled boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pred_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.pred_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  sport text NOT NULL,
  formats text[] NOT NULL DEFAULT '{}',
  plan jsonb NOT NULL,
  timing jsonb NOT NULL,
  scoring jsonb NOT NULL,
  participant_limit int CHECK (participant_limit IS NULL OR participant_limit > 0),
  auto_generate boolean NOT NULL DEFAULT true,
  require_approval boolean NOT NULL DEFAULT false,
  allow_edit boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Contests, questions, keys
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pred_contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_key text NOT NULL UNIQUE,
  template_id uuid REFERENCES public.pred_templates(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.pred_categories(id) ON DELETE SET NULL,
  match_id uuid REFERENCES public.cricket_matches(id) ON DELETE SET NULL,
  sport text NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('pre_match','innings_break','after_over','match_completed')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('draft','scheduled','published','locked','settling','completed','cancelled')),
  opens_at timestamptz NOT NULL,
  locks_at timestamptz NOT NULL,
  participant_limit int CHECK (participant_limit IS NULL OR participant_limit > 0),
  allow_edit boolean NOT NULL DEFAULT false,
  scoring jsonb NOT NULL,
  correction_version int NOT NULL DEFAULT 0,
  cancel_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (locks_at > opens_at)
);
CREATE INDEX IF NOT EXISTS pred_contests_status_idx ON public.pred_contests (status, locks_at);
CREATE INDEX IF NOT EXISTS pred_contests_match_idx ON public.pred_contests (match_id);

CREATE TABLE IF NOT EXISTS public.pred_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.pred_contests(id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position >= 1),
  prompt text NOT NULL,
  options jsonb NOT NULL,
  rule jsonb NOT NULL,
  points int NOT NULL CHECK (points BETWEEN 1 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','void')),
  resolved_option text,
  void_reason text,
  resolved_at timestamptz,
  UNIQUE (contest_id, position)
);

-- Static (trivia / custom) answers live apart from the questions so players
-- can never read an answer before it is resolved. No RLS policy => service only.
CREATE TABLE IF NOT EXISTS public.pred_question_keys (
  question_id uuid PRIMARY KEY REFERENCES public.pred_questions(id) ON DELETE CASCADE,
  static_correct text NOT NULL
);

-- ---------------------------------------------------------------------------
-- Entries, answers, scores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pred_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.pred_contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  points int NOT NULL DEFAULT 0,
  correct int NOT NULL DEFAULT 0,
  UNIQUE (contest_id, user_id)
);
CREATE INDEX IF NOT EXISTS pred_entries_user_idx ON public.pred_entries (user_id);

CREATE TABLE IF NOT EXISTS public.pred_answers (
  entry_id uuid NOT NULL REFERENCES public.pred_entries(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.pred_questions(id) ON DELETE CASCADE,
  contest_id uuid NOT NULL,
  option_id text NOT NULL,
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.pred_scores (
  entry_id uuid NOT NULL REFERENCES public.pred_entries(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.pred_questions(id) ON DELETE CASCADE,
  points int NOT NULL,
  correct boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, question_id)
);

-- ---------------------------------------------------------------------------
-- Provider events, corrections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pred_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.cricket_matches(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  innings int NOT NULL,
  over int NOT NULL,
  seq int NOT NULL,
  legal boolean NOT NULL,
  runs_bat int NOT NULL DEFAULT 0,
  extras int NOT NULL DEFAULT 0,
  wicket boolean NOT NULL DEFAULT false,
  revision int NOT NULL DEFAULT 1,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, event_key)
);
CREATE INDEX IF NOT EXISTS pred_events_match_idx ON public.pred_events (match_id, innings, over, seq);

CREATE TABLE IF NOT EXISTS public.pred_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.pred_questions(id) ON DELETE CASCADE,
  contest_id uuid NOT NULL,
  before_state jsonb NOT NULL,
  after_state jsonb NOT NULL,
  actor text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Virtual points: append-only ledger + wallet balance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pred_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount int NOT NULL CHECK (amount <> 0),
  kind text NOT NULL,
  ref_key text NOT NULL UNIQUE,
  contest_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pred_ledger_user_idx ON public.pred_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pred_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Notifications, preferences, jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pred_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = broadcast
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pred_notifications_user_idx ON public.pred_notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pred_notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  match boolean NOT NULL DEFAULT true,
  contest boolean NOT NULL DEFAULT true,
  deadline boolean NOT NULL DEFAULT true,
  result boolean NOT NULL DEFAULT true,
  reward boolean NOT NULL DEFAULT true,
  rank boolean NOT NULL DEFAULT true,
  correction boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.pred_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','ok','failed')),
  attempts int NOT NULL DEFAULT 1,
  error text,
  result jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS pred_jobs_recent_idx ON public.pred_jobs (started_at DESC);

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.pred_contest_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, private AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'draft'     AND NEW.status IN ('scheduled','cancelled')) OR
      (OLD.status = 'scheduled' AND NEW.status IN ('published','cancelled','draft')) OR
      (OLD.status = 'published' AND NEW.status IN ('locked','cancelled')) OR
      (OLD.status = 'locked'    AND NEW.status IN ('settling','completed','cancelled')) OR
      (OLD.status = 'settling'  AND NEW.status IN ('completed','cancelled'))
    ) THEN
      RAISE EXCEPTION 'invalid contest transition % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'completed' THEN NEW.completed_at := now(); END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pred_contest_guard ON public.pred_contests;
CREATE TRIGGER pred_contest_guard BEFORE UPDATE ON public.pred_contests
  FOR EACH ROW EXECUTE FUNCTION private.pred_contest_guard();

-- Answers can only be written while the contest is published and before it locks.
CREATE OR REPLACE FUNCTION private.pred_answers_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, private AS $$
DECLARE c record; cid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN cid := OLD.contest_id; ELSE cid := NEW.contest_id; END IF;
  SELECT status, locks_at INTO c FROM public.pred_contests WHERE id = cid;
  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW; -- cascade from a removed contest
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF c.status IN ('draft','scheduled','cancelled') THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'answers cannot be deleted' USING ERRCODE = 'check_violation';
  END IF;
  IF c.status <> 'published' OR now() >= c.locks_at THEN
    RAISE EXCEPTION 'contest is locked' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pred_answers_guard ON public.pred_answers;
CREATE TRIGGER pred_answers_guard BEFORE INSERT OR UPDATE OR DELETE ON public.pred_answers
  FOR EACH ROW EXECUTE FUNCTION private.pred_answers_guard();

-- Questions are frozen once published; results change only via the logged function.
CREATE OR REPLACE FUNCTION private.pred_question_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, private AS $$
DECLARE cs text;
BEGIN
  SELECT status INTO cs FROM public.pred_contests WHERE id = OLD.contest_id;
  IF (NEW.prompt IS DISTINCT FROM OLD.prompt OR NEW.options IS DISTINCT FROM OLD.options
      OR NEW.rule IS DISTINCT FROM OLD.rule OR NEW.points IS DISTINCT FROM OLD.points
      OR NEW.position IS DISTINCT FROM OLD.position)
     AND cs NOT IN ('draft','scheduled') THEN
    RAISE EXCEPTION 'questions cannot change after publication' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.resolved_option IS DISTINCT FROM OLD.resolved_option THEN
    IF OLD.status = 'open' THEN
      IF cs NOT IN ('locked','settling') THEN
        RAISE EXCEPTION 'questions can only be resolved after the contest locks' USING ERRCODE = 'check_violation';
      END IF;
    ELSIF coalesce(current_setting('pred.correction', true), '') <> 'on' THEN
      RAISE EXCEPTION 'results can only change through the logged correction process' USING ERRCODE = 'check_violation';
    END IF;
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pred_question_guard ON public.pred_questions;
CREATE TRIGGER pred_question_guard BEFORE UPDATE ON public.pred_questions
  FOR EACH ROW EXECUTE FUNCTION private.pred_question_guard();

-- The ledger is append-only.
CREATE OR REPLACE FUNCTION private.pred_ledger_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'the points ledger is append-only' USING ERRCODE = 'check_violation';
END $$;
DROP TRIGGER IF EXISTS pred_ledger_immutable ON public.pred_ledger;
CREATE TRIGGER pred_ledger_immutable BEFORE UPDATE OR DELETE ON public.pred_ledger
  FOR EACH ROW EXECUTE FUNCTION private.pred_ledger_immutable();

-- ---------------------------------------------------------------------------
-- Functions (SECURITY DEFINER in private, thin wrappers in public)
-- ---------------------------------------------------------------------------

-- Player submits answers. Enforces status, window, limits and valid options atomically.
CREATE OR REPLACE FUNCTION private.pred_submit(_contest_id uuid, _answers jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  uid uuid := auth.uid();
  c public.pred_contests%ROWTYPE;
  eid uuid;
  existed boolean;
  a record;
  n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in required' USING ERRCODE = '28000'; END IF;
  IF jsonb_typeof(_answers) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'answers must be an object'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND banned IS TRUE) THEN
    RAISE EXCEPTION 'account is restricted' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_contest_id::text));
  SELECT * INTO c FROM public.pred_contests WHERE id = _contest_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'contest not found'; END IF;
  IF c.status <> 'published' OR now() < c.opens_at OR now() >= c.locks_at THEN
    RAISE EXCEPTION 'contest is not open' USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO eid FROM public.pred_entries WHERE contest_id = c.id AND user_id = uid;
  existed := eid IS NOT NULL;
  IF existed AND NOT c.allow_edit THEN
    RAISE EXCEPTION 'answers are final once submitted' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT existed AND c.participant_limit IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.pred_entries WHERE contest_id = c.id;
    IF n >= c.participant_limit THEN RAISE EXCEPTION 'contest is full' USING ERRCODE = 'check_violation'; END IF;
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(_answers)) = 0 THEN RAISE EXCEPTION 'no answers supplied'; END IF;

  FOR a IN SELECT key, value FROM jsonb_each_text(_answers) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.pred_questions q, jsonb_array_elements(q.options) o
      WHERE q.id::text = a.key AND q.contest_id = c.id AND o->>'id' = a.value
    ) THEN RAISE EXCEPTION 'invalid answer for question %', a.key USING ERRCODE = 'check_violation'; END IF;
  END LOOP;

  IF NOT existed THEN
    INSERT INTO public.pred_entries (contest_id, user_id) VALUES (c.id, uid) RETURNING id INTO eid;
  END IF;
  INSERT INTO public.pred_answers (entry_id, question_id, contest_id, option_id)
  SELECT eid, key::uuid, c.id, value FROM jsonb_each_text(_answers)
  ON CONFLICT (entry_id, question_id) DO UPDATE SET option_id = EXCLUDED.option_id, answered_at = now();
  RETURN eid;
END $$;

-- Atomically creates a contest with its questions; a repeat of the same generation_key is a no-op.
CREATE OR REPLACE FUNCTION private.pred_insert_contest(_c jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE cid uuid; q jsonb; qid uuid;
BEGIN
  INSERT INTO public.pred_contests (
    generation_key, template_id, category_id, match_id, sport, trigger, title, status,
    opens_at, locks_at, participant_limit, allow_edit, scoring, created_by
  ) VALUES (
    _c->>'generationKey', nullif(_c->>'templateId','')::uuid, nullif(_c->>'categoryId','')::uuid,
    nullif(_c->>'matchId','')::uuid, _c->>'sport', _c->>'trigger', _c->>'title', _c->>'status',
    (_c->>'opensAt')::timestamptz, (_c->>'locksAt')::timestamptz,
    nullif(_c->>'participantLimit','')::int, coalesce((_c->>'allowEdit')::boolean, false), _c->'scoring',
    nullif(_c->>'createdBy','')::uuid
  ) ON CONFLICT (generation_key) DO NOTHING RETURNING id INTO cid;

  IF cid IS NULL THEN
    SELECT id INTO cid FROM public.pred_contests WHERE generation_key = _c->>'generationKey';
    RETURN jsonb_build_object('id', cid, 'created', false);
  END IF;

  FOR q IN SELECT * FROM jsonb_array_elements(_c->'questions') LOOP
    INSERT INTO public.pred_questions (contest_id, position, prompt, options, rule, points)
    VALUES (cid, (q->>'position')::int, q->>'prompt', q->'options', q->'rule', (q->>'points')::int)
    RETURNING id INTO qid;
    IF coalesce(q->>'staticCorrect','') <> '' THEN
      INSERT INTO public.pred_question_keys (question_id, static_correct) VALUES (qid, q->>'staticCorrect');
    END IF;
  END LOOP;
  RETURN jsonb_build_object('id', cid, 'created', true);
END $$;

-- The ONLY way a question result is set or changed. Changes to an existing
-- result are written to pred_corrections with actor and reason.
CREATE OR REPLACE FUNCTION private.pred_apply_resolution(
  _question_id uuid, _status text, _option text, _void_reason text, _actor text, _reason text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE q public.pred_questions%ROWTYPE; outcome text; want_option text;
BEGIN
  IF _status NOT IN ('resolved','void') THEN RAISE EXCEPTION 'invalid status'; END IF;
  SELECT * INTO q FROM public.pred_questions WHERE id = _question_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'question not found'; END IF;
  want_option := CASE WHEN _status = 'resolved' THEN _option END;
  IF _status = 'resolved' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(q.options) o WHERE o->>'id' = _option
  ) THEN RAISE EXCEPTION 'unknown option'; END IF;

  IF q.status = _status AND coalesce(q.resolved_option,'') = coalesce(want_option,'') THEN RETURN 'unchanged'; END IF;
  outcome := CASE WHEN q.status = 'open' THEN 'applied' ELSE 'changed' END;

  IF outcome = 'changed' THEN
    INSERT INTO public.pred_corrections (question_id, contest_id, before_state, after_state, actor, reason)
    VALUES (q.id, q.contest_id,
      jsonb_build_object('status', q.status, 'option', q.resolved_option, 'void_reason', q.void_reason),
      jsonb_build_object('status', _status, 'option', want_option, 'void_reason', _void_reason),
      coalesce(_actor,'unknown'), coalesce(_reason,'unspecified'));
  END IF;

  PERFORM set_config('pred.correction', 'on', true);
  UPDATE public.pred_questions SET
    status = _status,
    resolved_option = want_option,
    void_reason = CASE WHEN _status = 'void' THEN coalesce(_void_reason,'void') END
  WHERE id = q.id;
  PERFORM set_config('pred.correction', 'off', true);
  RETURN outcome;
END $$;

CREATE OR REPLACE FUNCTION private.pred_save_scores(_entry_id uuid, _scores jsonb, _points int, _correct int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
BEGIN
  INSERT INTO public.pred_scores (entry_id, question_id, points, correct)
  SELECT _entry_id, (s->>'questionId')::uuid, (s->>'points')::int, (s->>'correct')::boolean
  FROM jsonb_array_elements(_scores) s WHERE (s->>'counted')::boolean
  ON CONFLICT (entry_id, question_id) DO UPDATE SET points = EXCLUDED.points, correct = EXCLUDED.correct, updated_at = now()
  WHERE (public.pred_scores.points, public.pred_scores.correct) IS DISTINCT FROM (EXCLUDED.points, EXCLUDED.correct);
  UPDATE public.pred_entries SET points = _points, correct = _correct
  WHERE id = _entry_id AND (points, correct) IS DISTINCT FROM (_points, _correct);
END $$;

-- Idempotent virtual-points credit: a repeated ref_key changes nothing.
CREATE OR REPLACE FUNCTION private.pred_credit(_user_id uuid, _amount int, _kind text, _ref_key text, _contest_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE n int;
BEGIN
  IF _amount = 0 OR abs(_amount) > 100000 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  INSERT INTO public.pred_ledger (user_id, amount, kind, ref_key, contest_id)
  VALUES (_user_id, _amount, _kind, _ref_key, _contest_id) ON CONFLICT (ref_key) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN false; END IF;
  INSERT INTO public.pred_wallets (user_id, balance) VALUES (_user_id, _amount)
  ON CONFLICT (user_id) DO UPDATE SET balance = public.pred_wallets.balance + EXCLUDED.balance, updated_at = now();
  RETURN true;
END $$;

-- Deterministic leaderboard. Ties: points, correct answers, earliest first entry, user id.
CREATE OR REPLACE FUNCTION private.pred_board(
  _scope text, _scope_id text, _since timestamptz, _until timestamptz,
  _limit int, _only_user uuid, _friends boolean
) RETURNS TABLE (rank_no bigint, user_id uuid, username text, avatar_url text, points bigint, correct bigint, contests bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  WITH base AS (
    SELECT e.user_id, e.points, e.correct, e.submitted_at, c.id AS contest_id
    FROM public.pred_entries e JOIN public.pred_contests c ON c.id = e.contest_id
    WHERE c.status IN ('settling','completed')
      AND (_since IS NULL OR c.locks_at >= _since) AND (_until IS NULL OR c.locks_at < _until)
      AND CASE _scope
            WHEN 'contest'  THEN c.id::text = _scope_id
            WHEN 'match'    THEN c.match_id::text = _scope_id
            WHEN 'sport'    THEN c.sport = _scope_id
            WHEN 'category' THEN c.category_id::text = _scope_id
            WHEN 'overall'  THEN true
            ELSE false END
      AND (NOT coalesce(_friends, false) OR e.user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.follows f WHERE f.follower_id = auth.uid() AND f.following_id = e.user_id))
  ), agg AS (
    SELECT b.user_id, sum(b.points)::bigint AS points, sum(b.correct)::bigint AS correct,
           count(DISTINCT b.contest_id)::bigint AS contests, min(b.submitted_at) AS first_at
    FROM base b GROUP BY b.user_id
  ), ranked AS (
    SELECT row_number() OVER (ORDER BY a.points DESC, a.correct DESC, a.first_at ASC, a.user_id ASC) AS rank_no, a.*
    FROM agg a
  )
  SELECT r.rank_no, r.user_id,
         coalesce(nullif(p.username,''), nullif(split_part(coalesce(p.full_name,''),' ',1),''), 'Player') AS username,
         p.avatar_url, r.points, r.correct, r.contests
  FROM ranked r LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE _only_user IS NULL OR r.user_id = _only_user
  ORDER BY r.rank_no
  LIMIT CASE WHEN _only_user IS NULL THEN greatest(1, least(coalesce(_limit, 50), 200)) ELSE 1 END
$$;

-- Wrappers ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pred_submit_answers(_contest_id uuid, _answers jsonb) RETURNS uuid
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public, private AS $$ SELECT private.pred_submit(_contest_id, _answers) $$;

CREATE OR REPLACE FUNCTION public.pred_board(
  _scope text, _scope_id text, _since timestamptz, _until timestamptz, _limit int, _only_user uuid, _friends boolean
) RETURNS TABLE (rank_no bigint, user_id uuid, username text, avatar_url text, points bigint, correct bigint, contests bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, private AS $$
  SELECT * FROM private.pred_board(_scope, _scope_id, _since, _until, _limit, _only_user, _friends) $$;

CREATE OR REPLACE FUNCTION public.pred_insert_contest(_c jsonb) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public, private AS $$ SELECT private.pred_insert_contest(_c) $$;

CREATE OR REPLACE FUNCTION public.pred_apply_resolution(_question_id uuid, _status text, _option text, _void_reason text, _actor text, _reason text) RETURNS text
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public, private AS $$ SELECT private.pred_apply_resolution(_question_id, _status, _option, _void_reason, _actor, _reason) $$;

CREATE OR REPLACE FUNCTION public.pred_save_scores(_entry_id uuid, _scores jsonb, _points int, _correct int) RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public, private AS $$ SELECT private.pred_save_scores(_entry_id, _scores, _points, _correct) $$;

CREATE OR REPLACE FUNCTION public.pred_credit(_user_id uuid, _amount int, _kind text, _ref_key text, _contest_id uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public, private AS $$ SELECT private.pred_credit(_user_id, _amount, _kind, _ref_key, _contest_id) $$;

-- ---------------------------------------------------------------------------
-- Privileges + Row Level Security
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.pred_submit(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.pred_board(text, text, timestamptz, timestamptz, int, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.pred_insert_contest(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pred_apply_resolution(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pred_save_scores(uuid, jsonb, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.pred_credit(uuid, int, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.pred_submit(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.pred_board(text, text, timestamptz, timestamptz, int, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.pred_insert_contest(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.pred_apply_resolution(uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION private.pred_save_scores(uuid, jsonb, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION private.pred_credit(uuid, int, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.pred_submit_answers(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pred_board(text, text, timestamptz, timestamptz, int, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pred_insert_contest(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pred_apply_resolution(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pred_save_scores(uuid, jsonb, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pred_credit(uuid, int, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pred_submit_answers(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pred_board(text, text, timestamptz, timestamptz, int, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pred_insert_contest(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.pred_apply_resolution(uuid, text, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pred_save_scores(uuid, jsonb, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.pred_credit(uuid, int, text, text, uuid) TO service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pred_sports','pred_categories','pred_templates','pred_contests','pred_questions','pred_question_keys',
    'pred_entries','pred_answers','pred_scores','pred_events','pred_corrections','pred_ledger','pred_wallets',
    'pred_notifications','pred_notification_prefs','pred_jobs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

GRANT SELECT ON public.pred_sports, public.pred_categories, public.pred_contests, public.pred_questions,
  public.pred_events, public.pred_entries, public.pred_answers, public.pred_scores, public.pred_ledger,
  public.pred_wallets, public.pred_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pred_notification_prefs TO authenticated;

DROP POLICY IF EXISTS "pred sports readable" ON public.pred_sports;
CREATE POLICY "pred sports readable" ON public.pred_sports FOR SELECT TO authenticated USING (enabled);
DROP POLICY IF EXISTS "pred categories readable" ON public.pred_categories;
CREATE POLICY "pred categories readable" ON public.pred_categories FOR SELECT TO authenticated USING (enabled);
DROP POLICY IF EXISTS "pred contests readable" ON public.pred_contests;
CREATE POLICY "pred contests readable" ON public.pred_contests FOR SELECT TO authenticated
  USING (status IN ('published','locked','settling','completed','cancelled'));
DROP POLICY IF EXISTS "pred questions readable" ON public.pred_questions;
CREATE POLICY "pred questions readable" ON public.pred_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pred_contests c WHERE c.id = contest_id
                 AND c.status IN ('published','locked','settling','completed','cancelled')));
DROP POLICY IF EXISTS "pred events readable" ON public.pred_events;
CREATE POLICY "pred events readable" ON public.pred_events FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pred own entries" ON public.pred_entries;
CREATE POLICY "pred own entries" ON public.pred_entries FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "pred own answers" ON public.pred_answers;
CREATE POLICY "pred own answers" ON public.pred_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pred_entries e WHERE e.id = entry_id AND e.user_id = auth.uid()));
DROP POLICY IF EXISTS "pred own scores" ON public.pred_scores;
CREATE POLICY "pred own scores" ON public.pred_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pred_entries e WHERE e.id = entry_id AND e.user_id = auth.uid()));
DROP POLICY IF EXISTS "pred own ledger" ON public.pred_ledger;
CREATE POLICY "pred own ledger" ON public.pred_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "pred own wallet" ON public.pred_wallets;
CREATE POLICY "pred own wallet" ON public.pred_wallets FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "pred own and broadcast notifications" ON public.pred_notifications;
CREATE POLICY "pred own and broadcast notifications" ON public.pred_notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
DROP POLICY IF EXISTS "pred own prefs read" ON public.pred_notification_prefs;
CREATE POLICY "pred own prefs read" ON public.pred_notification_prefs FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "pred own prefs insert" ON public.pred_notification_prefs;
CREATE POLICY "pred own prefs insert" ON public.pred_notification_prefs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "pred own prefs update" ON public.pred_notification_prefs;
CREATE POLICY "pred own prefs update" ON public.pred_notification_prefs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seed data (idempotent). Everything here is editable from the admin panel.
-- ---------------------------------------------------------------------------
INSERT INTO public.pred_sports (key, name, enabled, provider_supported, sort_order) VALUES
  ('cricket','Cricket',true,true,1),
  ('football','Football',false,false,2),
  ('basketball','Basketball',false,false,3),
  ('tennis','Tennis',false,false,4),
  ('kabaddi','Kabaddi',false,false,5),
  ('esports','Esports',false,false,6),
  ('general','General & Trivia',true,false,7)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.pred_categories (key, name, description, sport, enabled, sort_order) VALUES
  ('match_winner','Match winner quiz','Pick the winner of the match.','cricket',true,1),
  ('first_over','Over-by-over quiz','Predict each legal delivery of an over. Needs ball-by-ball data.','cricket',true,2),
  ('innings_total','Innings total quiz','Predict the score range of an innings.','cricket',true,3),
  ('top_performers','Top batter / bowler quiz','Needs a provider that supplies scorecards.','cricket',false,4),
  ('football_quiz','Football quizzes','Admin-built football contests.','football',false,5),
  ('basketball_quiz','Basketball quizzes','Admin-built basketball contests.','basketball',false,6),
  ('tennis_quiz','Tennis quizzes','Admin-built tennis contests.','tennis',false,7),
  ('kabaddi_quiz','Kabaddi quizzes','Admin-built kabaddi contests.','kabaddi',false,8),
  ('esports_quiz','Esports quizzes','Admin-built esports contests.','esports',false,9),
  ('gk_trivia','GK & sports trivia','Static-answer trivia contests.','general',true,10),
  ('custom','Custom contests','Contests built in the visual builder.','any',true,11)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.pred_templates (category_id, name, description, sport, formats, plan, timing, scoring, auto_generate, require_approval, enabled)
SELECT c.id, v.name, v.description, 'cricket', v.formats, v.plan::jsonb, v.timing::jsonb,
       '{"pointsPerCorrect":10,"negativePerWrong":0}'::jsonb, true, false, v.enabled
FROM (VALUES
  ('match_winner', 'Match winner', 'Settles from the official result.', ARRAY[]::text[],
   '{"generator":"match_winner"}',
   '{"trigger":"pre_match","createBeforeMin":60,"opensBeforeMin":30,"locksBeforeMin":1,"lockAfterMin":5,"catchUp":"shorten","minOpenMin":5}', true),
  ('innings_total', 'First innings total', 'Settles from the verified innings score.', ARRAY['t20','odi','t10'],
   '{"generator":"innings_total","innings":1}',
   '{"trigger":"pre_match","createBeforeMin":60,"opensBeforeMin":30,"locksBeforeMin":1,"lockAfterMin":5,"catchUp":"shorten","minOpenMin":5}', true),
  ('first_over', 'First over, ball by ball', 'DISABLED until a ball-by-ball provider is configured and verified.', ARRAY['t20','odi','t10'],
   '{"generator":"over_by_over","innings":1,"over":1,"balls":6}',
   '{"trigger":"pre_match","createBeforeMin":60,"opensBeforeMin":30,"locksBeforeMin":1,"lockAfterMin":5,"catchUp":"shorten","minOpenMin":5}', false)
) AS v(cat, name, description, formats, plan, timing, enabled)
JOIN public.pred_categories c ON c.key = v.cat
WHERE NOT EXISTS (SELECT 1 FROM public.pred_templates t WHERE t.name = v.name AND t.sport = 'cricket');

INSERT INTO public.app_settings (key, value) VALUES
  ('pred_reward_rules', '{"participation":5,"perCorrect":2,"rankBonus":[50,30,20],"maxPerContest":200,"dailyCap":1000}'::jsonb),
  ('pred_engine_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;
