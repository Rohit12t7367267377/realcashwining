-- Add sports categories
INSERT INTO public.categories (slug, name, icon, sort_order, active, description)
VALUES
  ('cricket', 'Cricket', '🏏', 100, true, 'Live cricket match quizzes'),
  ('football', 'Football', '⚽', 101, true, 'Live football match quizzes')
ON CONFLICT (slug) DO NOTHING;

-- Books table
CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  file_path text NOT NULL,
  file_size bigint,
  uploaded_by uuid,
  downloads integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.books TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "books public read" ON public.books FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "books admin write" ON public.books FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow public to increment downloads via RPC
CREATE OR REPLACE FUNCTION public.increment_book_download(_book_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.books SET downloads = downloads + 1 WHERE id = _book_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_book_download(uuid) TO anon, authenticated;