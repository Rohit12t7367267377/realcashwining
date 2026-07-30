
CREATE POLICY "community read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community');
CREATE POLICY "community upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "community delete own or admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
