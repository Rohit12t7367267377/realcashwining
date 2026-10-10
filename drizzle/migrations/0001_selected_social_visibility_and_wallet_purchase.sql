ALTER POLICY "Anyone read follows" ON public.follows USING (auth.uid() IN (follower_id, following_id) OR public.has_role(auth.uid(),'admin'));
ALTER POLICY "likes visible" ON public.post_likes USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND NOT p.hidden));
ALTER POLICY "Signed in users view ratings" ON public.post_ratings USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id AND NOT p.hidden));
ALTER POLICY "Anyone signed in can view prizes" ON public.prize_awards USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.purchase_membership_wallet(_membership_id uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.memberships%ROWTYPE; v_user uuid := auth.uid(); v_balance numeric; v_ends timestamptz;
BEGIN
IF v_user IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
SELECT * INTO p FROM public.memberships WHERE id = _membership_id AND active;
IF NOT FOUND OR p.price < 0 THEN RAISE EXCEPTION 'Plan unavailable'; END IF;
SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_user AND NOT banned FOR UPDATE;
IF NOT FOUND OR v_balance < p.price THEN RAISE EXCEPTION 'Insufficient balance or account unavailable'; END IF;
v_ends := now() + make_interval(days => p.duration_days);
UPDATE public.profiles SET wallet_balance = wallet_balance - p.price WHERE id = v_user;
INSERT INTO public.transactions(user_id,type,amount,note) VALUES (v_user,'debit',p.price,'VIP: ' || p.name);
INSERT INTO public.user_memberships(user_id,membership_id,ends_at,status) VALUES (v_user,p.id,v_ends,'active');
RETURN v_ends;
END; $$;
REVOKE ALL ON FUNCTION public.purchase_membership_wallet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_membership_wallet(uuid) TO authenticated,service_role;
