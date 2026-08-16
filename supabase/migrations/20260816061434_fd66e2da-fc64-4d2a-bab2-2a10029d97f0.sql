-- 1. Hide the quiz answer key from clients (column-level privileges)
REVOKE SELECT ON public.questions FROM anon, authenticated;
GRANT SELECT (id, category_id, question, options, difficulty, created_at, time_seconds) ON public.questions TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;

-- 2. Coupons: no direct reads; redemption happens through the redeem_coupon function
DROP POLICY IF EXISTS "Auth read active coupons" ON public.coupons;

-- 3. user_xp: no anonymous reads
DROP POLICY IF EXISTS "user_xp public read" ON public.user_xp;
CREATE POLICY "user_xp auth read" ON public.user_xp FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.user_xp FROM anon;

-- 4. Pin search_path on remaining functions
ALTER FUNCTION public.xp_to_level(integer) SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;

-- 5. Trigger-only functions must not be callable through the API
REVOKE EXECUTE ON FUNCTION public.award_xp_on_attempt_complete() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_live_match() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_contest() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_wallet_credit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_post_counts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;

-- 6. Privileged/admin-only functions: server-side (service_role) use only
REVOKE EXECUTE ON FUNCTION public.grant_xp(uuid, integer, text, uuid, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_score_contest(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_event_notification(text, text, text, text, text, uuid, uuid, uuid[]) FROM anon, authenticated;

-- 7. User-facing functions require a signed-in user: drop anonymous execute
REVOKE EXECUTE ON FUNCTION public.join_contest(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_coupon(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_mission(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.open_reward_box(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_user_missions(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.submit_reading_attempt(uuid, jsonb, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_book_download(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_mutual_follow(uuid, uuid) FROM anon, authenticated;