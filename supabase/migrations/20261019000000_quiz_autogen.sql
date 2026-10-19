-- Automatic school quiz-contest generation (extends the existing contests/questions engine).
-- Additive only: no existing data is touched.

ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS auto_slot_key text,
  ADD COLUMN IF NOT EXISTS auto_scope jsonb;

-- One generated contest per time slot + scope, even if the scheduler retries or runs twice.
CREATE UNIQUE INDEX IF NOT EXISTS contests_auto_slot_key_uidx
  ON public.contests (auto_slot_key) WHERE auto_slot_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.quiz_autogen_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key text NOT NULL UNIQUE,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','skipped')),
  attempts integer NOT NULL DEFAULT 1,
  error text,
  contest_id uuid REFERENCES public.contests(id) ON DELETE SET NULL,
  question_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_autogen_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.quiz_autogen_runs TO authenticated;
GRANT ALL ON public.quiz_autogen_runs TO service_role;
DROP POLICY IF EXISTS "quiz autogen runs admin read" ON public.quiz_autogen_runs;
CREATE POLICY "quiz autogen runs admin read" ON public.quiz_autogen_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
