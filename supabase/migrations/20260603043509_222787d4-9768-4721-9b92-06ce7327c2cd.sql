CREATE POLICY "books bucket read" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'books');
CREATE POLICY "books bucket admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'books' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "books bucket admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'books' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "books bucket admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'books' AND public.has_role(auth.uid(), 'admin'::app_role));