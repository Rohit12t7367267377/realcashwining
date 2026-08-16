-- Execute privileges were inherited from PUBLIC; revoke there and re-grant narrowly.
REVOKE EXECUTE ON FUNCTION public.award_xp_on_attempt_complete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_live_match() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_contest() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_wallet_credit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_post_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_mutual_follow(uuid, uuid) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.grant_xp(uuid, integer, text, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.queue_event_notification(text, text, text, text, text, uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_xp(uuid, integer, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_event_notification(text, text, text, text, text, uuid, uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_mutual_follow(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_mission(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.open_reward_box(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_coupon(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_user_missions(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_reading_attempt(uuid, jsonb, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_book_download(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_mission(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_reward_box(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_user_missions(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_reading_attempt(uuid, jsonb, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_book_download(uuid) TO authenticated, service_role;