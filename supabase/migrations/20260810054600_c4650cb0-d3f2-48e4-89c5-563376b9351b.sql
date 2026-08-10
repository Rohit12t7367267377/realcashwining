ALTER TABLE public.cricket_matches
  ADD COLUMN IF NOT EXISTS series text,
  ADD COLUMN IF NOT EXISTS squads jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.cricket_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_quiz boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_result boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS review_required boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS contests_match_id_idx ON public.contests(match_id);

ALTER TABLE public.reading_passages
  ADD COLUMN IF NOT EXISTS match_id uuid REFERENCES public.cricket_matches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.sports_quiz_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.cricket_matches(id) ON DELETE CASCADE,
  contest_id uuid REFERENCES public.contests(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  question text NOT NULL,
  options jsonb NOT NULL,
  correct_index integer NOT NULL,
  explanation text,
  difficulty text NOT NULL DEFAULT 'medium',
  source text NOT NULL DEFAULT 'ai',
  status text NOT NULL DEFAULT 'pending',
  published_question_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_quiz_drafts TO authenticated;
GRANT ALL ON public.sports_quiz_drafts TO service_role;

ALTER TABLE public.sports_quiz_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sports quiz drafts"
  ON public.sports_quiz_drafts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS sports_quiz_drafts_status_idx ON public.sports_quiz_drafts(status, created_at DESC);

CREATE TRIGGER trg_sports_quiz_drafts_updated
  BEFORE UPDATE ON public.sports_quiz_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();