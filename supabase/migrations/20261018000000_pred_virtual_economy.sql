-- Fully automatic contest engine: virtual-points entry fees, pools, refunds, live/void states,
-- private invites, bonuses and operator controls. Additive: nothing is dropped or rewritten.
-- Everything here is VIRTUAL points: no deposits, no cash, no withdrawals, no transfers between players.

-- ---------------------------------------------------------------------------
-- Templates and contests: economics
-- ---------------------------------------------------------------------------
ALTER TABLE public.pred_templates
  ADD COLUMN IF NOT EXISTS entry_fee int NOT NULL DEFAULT 0 CHECK (entry_fee BETWEEN 0 AND 100000),
  ADD COLUMN IF NOT EXISTS min_participants int NOT NULL DEFAULT 0 CHECK (min_participants >= 0),
  ADD COLUMN IF NOT EXISTS prize_split jsonb NOT NULL DEFAULT '[70]'::jsonb;

ALTER TABLE public.pred_contests
  ADD COLUMN IF NOT EXISTS entry_fee int NOT NULL DEFAULT 0 CHECK (entry_fee BETWEEN 0 AND 100000),
  ADD COLUMN IF NOT EXISTS min_participants int NOT NULL DEFAULT 0 CHECK (min_participants >= 0),
  ADD COLUMN IF NOT EXISTS prize_split jsonb NOT NULL DEFAULT '[70]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

ALTER TABLE public.pred_contests DROP CONSTRAINT IF EXISTS pred_contests_status_check;
ALTER TABLE public.pred_contests ADD CONSTRAINT pred_contests_status_check
  CHECK (status IN ('draft','scheduled','published','locked','live','settling','completed','cancelled','void'));

ALTER TABLE public.pred_entries ADD COLUMN IF NOT EXISTS fee_paid int NOT NULL DEFAULT 0 CHECK (fee_paid >= 0);

-- Delivery type, so wides and no-balls are recognised from the provider record and never guessed.
ALTER TABLE public.pred_events ADD COLUMN IF NOT EXISTS extra_type text
  CHECK (extra_type IS NULL OR extra_type IN ('wide','noball','bye','legbye'));

-- ---------------------------------------------------------------------------
-- New tables: platform bucket, settlements, private invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pred_platform_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.pred_contests(id) ON DELETE CASCADE,
  amount int NOT NULL CHECK (amount <> 0),
  kind text NOT NULL,
  ref_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pred_platform_ledger_contest_idx ON public.pred_platform_ledger (contest_id);

CREATE TABLE IF NOT EXISTS public.pred_settlements (
  contest_id uuid NOT NULL REFERENCES public.pred_contests(id) ON DELETE CASCADE,
  version int NOT NULL,
  participants int NOT NULL,
  pool int NOT NULL,
  prize_total int NOT NULL,
  platform_share int NOT NULL,
  payouts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, version),
  CHECK (pool = prize_total + platform_share)
);

CREATE TABLE IF NOT EXISTS public.pred_invites (
  contest_id uuid PRIMARY KEY REFERENCES public.pred_contests(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS public.pred_contest_members (
  contest_id uuid NOT NULL REFERENCES public.pred_contests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pred_platform_ledger','pred_settlements','pred_invites','pred_contest_members'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
GRANT SELECT ON public.pred_contest_members, public.pred_settlements TO authenticated;
DROP POLICY IF EXISTS "pred own membership" ON public.pred_contest_members;
CREATE POLICY "pred own membership" ON public.pred_contest_members FOR SELECT TO authenticated USING (user_id = auth.uid());
-- A player can read the settlement of a contest they entered (never anyone else's payouts list for private contests).
DROP POLICY IF EXISTS "pred settlements of own contests" ON public.pred_settlements;
CREATE POLICY "pred settlements of own contests" ON public.pred_settlements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pred_entries e WHERE e.contest_id = pred_settlements.contest_id AND e.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION private.pred_platform_ledger_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'the platform ledger is append-only' USING ERRCODE = 'check_violation';
END $$;
DROP TRIGGER IF EXISTS pred_platform_ledger_immutable ON public.pred_platform_ledger;
CREATE TRIGGER pred_platform_ledger_immutable BEFORE UPDATE OR DELETE ON public.pred_platform_ledger
  FOR EACH ROW EXECUTE FUNCTION private.pred_platform_ledger_immutable();

-- ---------------------------------------------------------------------------
-- Visibility: private contests are only visible to invited players / entrants. New states are public.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "pred contests readable" ON public.pred_contests;
CREATE POLICY "pred contests readable" ON public.pred_contests FOR SELECT TO authenticated
  USING (
    status IN ('published','locked','live','settling','completed','cancelled','void')
    AND (NOT is_private
         OR EXISTS (SELECT 1 FROM public.pred_contest_members m WHERE m.contest_id = pred_contests.id AND m.user_id = auth.uid())
         OR EXISTS (SELECT 1 FROM public.pred_entries e WHERE e.contest_id = pred_contests.id AND e.user_id = auth.uid()))
  );
DROP POLICY IF EXISTS "pred questions readable" ON public.pred_questions;
CREATE POLICY "pred questions readable" ON public.pred_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pred_contests c WHERE c.id = contest_id
                 AND c.status IN ('published','locked','live','settling','completed','cancelled','void')
                 AND (NOT c.is_private
                      OR EXISTS (SELECT 1 FROM public.pred_contest_members m WHERE m.contest_id = c.id AND m.user_id = auth.uid())
                      OR EXISTS (SELECT 1 FROM public.pred_entries e WHERE e.contest_id = c.id AND e.user_id = auth.uid()))));

-- ---------------------------------------------------------------------------
-- State machine (database-enforced)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.pred_contest_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, private AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'draft'     AND NEW.status IN ('scheduled','cancelled')) OR
      (OLD.status = 'scheduled' AND NEW.status IN ('published','cancelled','draft')) OR
      (OLD.status = 'published' AND NEW.status IN ('locked','live','cancelled')) OR
      (OLD.status = 'locked'    AND NEW.status IN ('live','settling','completed','cancelled','void')) OR
      (OLD.status = 'live'      AND NEW.status IN ('settling','completed','void')) OR
      (OLD.status = 'settling'  AND NEW.status IN ('completed','void'))
    ) THEN
      RAISE EXCEPTION 'invalid contest transition % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = 'completed' THEN NEW.completed_at := now(); END IF;
  END IF;
  -- Economics are frozen once anyone could have joined.
  IF OLD.status NOT IN ('draft','scheduled') AND (
       NEW.entry_fee IS DISTINCT FROM OLD.entry_fee OR NEW.prize_split IS DISTINCT FROM OLD.prize_split
       OR NEW.min_participants IS DISTINCT FROM OLD.min_participants OR NEW.scoring IS DISTINCT FROM OLD.scoring
       OR NEW.is_private IS DISTINCT FROM OLD.is_private) THEN
    RAISE EXCEPTION 'fees, prizes and scoring cannot change after a contest is open' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- Ledger: whitelisted kinds, and an entry fee can never take a balance below zero
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.pred_credit(_user_id uuid, _amount int, _kind text, _ref_key text, _contest_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE n int; bal bigint;
BEGIN
  IF _amount = 0 OR abs(_amount) > 100000 THEN RAISE EXCEPTION 'invalid amount'; END IF;
  IF _kind NOT IN ('participation','answers','rank_bonus','contest_reward','adjustment','prize','refund','entry_fee','welcome_bonus','daily_bonus') THEN
    RAISE EXCEPTION 'invalid ledger kind';
  END IF;
  IF _kind = 'entry_fee' AND _amount > 0 THEN RAISE EXCEPTION 'entry fees are debits'; END IF;
  IF _kind IN ('participation','answers','rank_bonus','contest_reward','prize','refund','welcome_bonus','daily_bonus') AND _amount < 0 THEN
    RAISE EXCEPTION 'this kind can only credit';
  END IF;

  INSERT INTO public.pred_wallets (user_id, balance) VALUES (_user_id, 0) ON CONFLICT (user_id) DO NOTHING;
  SELECT balance INTO bal FROM public.pred_wallets WHERE user_id = _user_id FOR UPDATE;
  IF _kind = 'entry_fee' AND bal + _amount < 0 THEN RAISE EXCEPTION 'not enough virtual points' USING ERRCODE = 'check_violation'; END IF;

  INSERT INTO public.pred_ledger (user_id, amount, kind, ref_key, contest_id)
  VALUES (_user_id, _amount, _kind, _ref_key, _contest_id) ON CONFLICT (ref_key) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RETURN false; END IF;
  UPDATE public.pred_wallets SET balance = balance + _amount, updated_at = now() WHERE user_id = _user_id;
  RETURN true;
END $$;

-- ---------------------------------------------------------------------------
-- Joining: atomic fee charge + entry. Repeat joins never charge twice (unique entry + unique ledger key).
-- ---------------------------------------------------------------------------
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
  IF NOT existed AND c.is_private AND NOT EXISTS (
    SELECT 1 FROM public.pred_contest_members m WHERE m.contest_id = c.id AND m.user_id = uid
  ) THEN RAISE EXCEPTION 'this contest is invite-only' USING ERRCODE = '42501'; END IF;
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
    IF c.entry_fee > 0 THEN
      -- Raises "not enough virtual points" (rolling the whole join back) when the balance is too low.
      PERFORM private.pred_credit(uid, -c.entry_fee, 'entry_fee', 'fee:' || c.id::text || ':' || uid::text, c.id);
    END IF;
    INSERT INTO public.pred_entries (contest_id, user_id, fee_paid) VALUES (c.id, uid, c.entry_fee) RETURNING id INTO eid;
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
    opens_at, locks_at, participant_limit, entry_fee, min_participants, prize_split, is_private,
    allow_edit, scoring, created_by
  ) VALUES (
    _c->>'generationKey', nullif(_c->>'templateId','')::uuid, nullif(_c->>'categoryId','')::uuid,
    nullif(_c->>'matchId','')::uuid, _c->>'sport', _c->>'trigger', _c->>'title', _c->>'status',
    (_c->>'opensAt')::timestamptz, (_c->>'locksAt')::timestamptz,
    nullif(_c->>'participantLimit','')::int,
    coalesce((_c->>'entryFee')::int, 0), coalesce((_c->>'minParticipants')::int, 0),
    coalesce(_c->'prizeSplit', '[70]'::jsonb), coalesce((_c->>'isPrivate')::boolean, false),
    coalesce((_c->>'allowEdit')::boolean, false), _c->'scoring',
    nullif(_c->>'createdBy','')::uuid
  ) ON CONFLICT (generation_key) DO NOTHING RETURNING id INTO cid;

  IF cid IS NULL THEN
    SELECT id INTO cid FROM public.pred_contests WHERE generation_key = _c->>'generationKey';
    RETURN jsonb_build_object('id', cid, 'created', false);
  END IF;

  IF coalesce(_c->>'inviteCode','') <> '' THEN
    INSERT INTO public.pred_invites (contest_id, code) VALUES (cid, _c->>'inviteCode');
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

-- ---------------------------------------------------------------------------
-- Private invites and bonuses (player-callable, authenticated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.pred_redeem_invite(_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE uid uuid := auth.uid(); cid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in required' USING ERRCODE = '28000'; END IF;
  SELECT i.contest_id INTO cid FROM public.pred_invites i WHERE i.code = upper(trim(_code));
  IF cid IS NULL THEN RAISE EXCEPTION 'invalid invite code' USING ERRCODE = 'check_violation'; END IF;
  INSERT INTO public.pred_contest_members (contest_id, user_id) VALUES (cid, uid) ON CONFLICT DO NOTHING;
  RETURN cid;
END $$;

-- Free virtual points: one welcome grant per player and one daily grant per UTC day. Amounts come from
-- app_settings.pred_bonus ({"welcome":100,"daily":20,"enabled":true}); points are non-redeemable.
CREATE OR REPLACE FUNCTION private.pred_claim_bonus() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE
  uid uuid := auth.uid();
  cfg jsonb;
  welcome int; daily int; got int := 0; w boolean := false; d boolean := false;
  today text := to_char((now() AT TIME ZONE 'utc')::date, 'YYYY-MM-DD');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in required' USING ERRCODE = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND banned IS TRUE) THEN
    RAISE EXCEPTION 'account is restricted' USING ERRCODE = '42501';
  END IF;
  SELECT value INTO cfg FROM public.app_settings WHERE key = 'pred_bonus';
  cfg := coalesce(cfg, '{}'::jsonb);
  IF coalesce((cfg->>'enabled')::boolean, true) IS FALSE THEN RETURN jsonb_build_object('welcome', 0, 'daily', 0); END IF;
  welcome := least(greatest(coalesce((cfg->>'welcome')::int, 100), 0), 10000);
  daily := least(greatest(coalesce((cfg->>'daily')::int, 20), 0), 10000);
  IF welcome > 0 THEN w := private.pred_credit(uid, welcome, 'welcome_bonus', 'welcome:' || uid::text, NULL); END IF;
  IF daily > 0 THEN d := private.pred_credit(uid, daily, 'daily_bonus', 'daily:' || uid::text || ':' || today, NULL); END IF;
  RETURN jsonb_build_object('welcome', CASE WHEN w THEN welcome ELSE 0 END, 'daily', CASE WHEN d THEN daily ELSE 0 END);
END $$;

-- ---------------------------------------------------------------------------
-- Public wrappers and grants
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pred_redeem_invite(_code text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = public, private AS $$ SELECT private.pred_redeem_invite(_code) $$;
CREATE OR REPLACE FUNCTION public.pred_claim_bonus() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = public, private AS $$ SELECT private.pred_claim_bonus() $$;

REVOKE ALL ON FUNCTION private.pred_redeem_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.pred_claim_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.pred_redeem_invite(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.pred_claim_bonus() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.pred_redeem_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pred_claim_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pred_redeem_invite(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pred_claim_bonus() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Seed: the spec's automatic ball-by-ball market (DISABLED until the ball feed is verified).
-- 3h before start the engine creates one contest per over (6 slots each), entry 13 points,
-- lock 5 min before start, +2 correct / -1 wrong / 0 unanswered, winner takes 70% of the pool.
-- ---------------------------------------------------------------------------
INSERT INTO public.pred_templates
  (category_id, name, description, sport, formats, plan, timing, scoring, participant_limit,
   entry_fee, min_participants, prize_split, auto_generate, require_approval, allow_edit, enabled)
SELECT c.id, 'Ball by ball · every over',
  'One contest per over for each innings, six legal-ball questions each. +2 correct, -1 wrong, 0 unanswered. Winner takes 70% of the entry pool; the rest goes to the platform bucket. Virtual points only.',
  'cricket', ARRAY['t20','t10','odi'],
  '{"generator":"over_markets","marketMode":"legal","inningsList":[1,2]}'::jsonb,
  '{"trigger":"pre_match","createBeforeMin":180,"opensBeforeMin":180,"locksBeforeMin":5,"lockAfterMin":5,"catchUp":"shorten","minOpenMin":5}'::jsonb,
  '{"pointsPerCorrect":2,"negativePerWrong":1}'::jsonb, NULL,
  13, 2, '[70]'::jsonb, true, false, false, false
FROM (SELECT id FROM public.pred_categories WHERE key = 'first_over' LIMIT 1) c
WHERE NOT EXISTS (SELECT 1 FROM public.pred_templates t WHERE t.name = 'Ball by ball · every over');

INSERT INTO public.app_settings (key, value)
VALUES ('pred_bonus', '{"enabled":true,"welcome":100,"daily":20}'::jsonb),
       ('pred_controls', '{"pauseGeneration":false,"pausePublication":false,"pauseSettlement":false,"abandonPolicy":"settle_verified","disabledSports":[],"disabledSeries":[],"excludedMatchIds":[]}'::jsonb)
ON CONFLICT (key) DO NOTHING;
