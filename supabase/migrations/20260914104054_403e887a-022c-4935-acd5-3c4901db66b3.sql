REVOKE ALL ON FUNCTION public.submit_withdrawal_atomic(numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_withdrawal_atomic(numeric,text) TO service_role;
CREATE OR REPLACE FUNCTION public.submit_withdrawal_atomic(_user_id uuid,_amount numeric,_upi_id text)
RETURNS TABLE(request_id uuid,new_balance numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_balance numeric; v_min numeric; v_max numeric; v_used numeric; v_id uuid;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'User required'; END IF;
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id=_user_id AND banned=false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable'; END IF;
  SELECT coalesce((value)::text::numeric,100) INTO v_min FROM public.app_settings WHERE key='min_withdrawal';
  SELECT coalesce((value)::text::numeric,5000) INTO v_max FROM public.app_settings WHERE key='max_withdrawal_per_day';
  SELECT coalesce(sum(amount),0) INTO v_used FROM public.withdrawal_requests WHERE user_id=_user_id AND created_at>=now()-interval '24 hours' AND status IN('pending','approved','paid');
  IF _amount<coalesce(v_min,100) THEN RAISE EXCEPTION 'Below minimum withdrawal'; END IF;
  IF v_used+_amount>coalesce(v_max,5000) THEN RAISE EXCEPTION 'Daily withdrawal limit exceeded'; END IF;
  IF v_balance<_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET wallet_balance=wallet_balance-_amount WHERE id=_user_id RETURNING wallet_balance INTO v_balance;
  INSERT INTO public.withdrawal_requests(user_id,amount,upi_id,status) VALUES(_user_id,_amount,_upi_id,'pending') RETURNING id INTO v_id;
  INSERT INTO public.transactions(user_id,type,amount,note) VALUES(_user_id,'debit',_amount,'Withdrawal requested → '||_upi_id);
  RETURN QUERY SELECT v_id,v_balance;
END $$;
REVOKE ALL ON FUNCTION public.submit_withdrawal_atomic(uuid,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_withdrawal_atomic(uuid,numeric,text) TO service_role;
DROP FUNCTION public.submit_withdrawal_atomic(numeric,text);