ALTER POLICY "user_xp auth read" ON public.user_xp USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
