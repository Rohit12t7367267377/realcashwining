CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.claim_mission(uuid) SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.increment_book_download(uuid) SET SCHEMA private;
ALTER FUNCTION public.join_contest(uuid) SET SCHEMA private;
ALTER FUNCTION public.open_reward_box(uuid) SET SCHEMA private;
ALTER FUNCTION public.redeem_coupon(text) SET SCHEMA private;
ALTER FUNCTION public.refresh_user_missions(uuid) SET SCHEMA private;
ALTER FUNCTION public.submit_reading_attempt(uuid, jsonb, integer) SET SCHEMA private;

REVOKE ALL ON FUNCTION private.claim_mission(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.increment_book_download(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.join_contest(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.open_reward_box(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.redeem_coupon(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.refresh_user_missions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.submit_reading_attempt(uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.claim_mission(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.increment_book_download(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.join_contest(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.open_reward_box(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.redeem_coupon(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.refresh_user_missions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.submit_reading_attempt(uuid, jsonb, integer) TO authenticated, service_role;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.has_role(_user_id, _role) $$;

CREATE FUNCTION public.claim_mission(_user_mission_id uuid)
RETURNS TABLE(reward_xp integer, reward_coins numeric)
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT * FROM private.claim_mission(_user_mission_id) $$;

CREATE FUNCTION public.increment_book_download(_book_id uuid)
RETURNS void
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.increment_book_download(_book_id) $$;

CREATE FUNCTION public.join_contest(_contest_id uuid)
RETURNS TABLE(attempt_id uuid, charged numeric, already boolean)
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT * FROM private.join_contest(_contest_id) $$;

CREATE FUNCTION public.open_reward_box(_box_id uuid)
RETURNS TABLE(reward_xp integer, reward_coins numeric, tier text)
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT * FROM private.open_reward_box(_box_id) $$;

CREATE FUNCTION public.redeem_coupon(_code text)
RETURNS TABLE(amount numeric, xp_amount integer, note text)
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT * FROM private.redeem_coupon(_code) $$;

CREATE FUNCTION public.refresh_user_missions(_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT private.refresh_user_missions(_user_id) $$;

CREATE FUNCTION public.submit_reading_attempt(_attempt_id uuid, _answers jsonb, _quiz_seconds_spent integer)
RETURNS TABLE(score numeric, correct_count integer, wrong_count integer, unanswered_count integer, accuracy numeric)
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = public, private
AS $$ SELECT * FROM private.submit_reading_attempt(_attempt_id, _answers, _quiz_seconds_spent) $$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_mission(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_book_download(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_contest(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_reward_box(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_coupon(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_user_missions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_reading_attempt(uuid, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_mission(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_book_download(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_contest(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_reward_box(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_user_missions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_reading_attempt(uuid, jsonb, integer) TO authenticated, service_role;