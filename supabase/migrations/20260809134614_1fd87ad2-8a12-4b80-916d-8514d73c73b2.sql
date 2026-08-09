REVOKE EXECUTE ON FUNCTION public.queue_event_notification(text, text, text, text, text, uuid, uuid, uuid[]) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_contest() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_live_match() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_wallet_credit() FROM anon, authenticated;