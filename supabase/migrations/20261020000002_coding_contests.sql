-- Coding & DSA contests (free, virtual). Code is NEVER executed on the app server: submissions are
-- sent to an external, isolated judge (Judge0-compatible) configured through server secrets.
-- Hidden test cases are readable by service_role only.

CREATE TABLE IF NOT EXISTS public.coding_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  statement text NOT NULL CHECK (char_length(statement) BETWEEN 10 AND 20000),
  input_format text NOT NULL DEFAULT '',
  output_format text NOT NULL DEFAULT '',
  constraints_text text NOT NULL DEFAULT '',
  sample_input text NOT NULL DEFAULT '',
  sample_output text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  points integer NOT NULL DEFAULT 100 CHECK (points BETWEEN 1 AND 10000),
  time_limit_ms integer NOT NULL DEFAULT 2000 CHECK (time_limit_ms BETWEEN 100 AND 15000),
  memory_limit_mb integer NOT NULL DEFAULT 256 CHECK (memory_limit_mb BETWEEN 16 AND 1024),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS coding_problems_contest_idx ON public.coding_problems(contest_id, sort_order);

CREATE TABLE IF NOT EXISTS public.coding_testcases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id uuid NOT NULL REFERENCES public.coding_problems(id) ON DELETE CASCADE,
  input text NOT NULL,
  expected_output text NOT NULL,
  weight integer NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 1000),
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS coding_testcases_problem_idx ON public.coding_testcases(problem_id, sort_order);

CREATE TABLE IF NOT EXISTS public.coding_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id uuid NOT NULL REFERENCES public.coding_problems(id) ON DELETE CASCADE,
  contest_id uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  language text NOT NULL CHECK (language IN ('python','cpp','c','java','javascript')),
  source_code text NOT NULL CHECK (char_length(source_code) BETWEEN 1 AND 65536),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued','running','accepted','partial','wrong_answer','time_limit','memory_limit',
    'runtime_error','compile_error','judge_unavailable','internal_error')),
  passed integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  judged_at timestamptz
);
CREATE INDEX IF NOT EXISTS coding_submissions_user_idx ON public.coding_submissions(contest_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coding_submissions_problem_idx ON public.coding_submissions(problem_id, user_id);

ALTER TABLE public.coding_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_testcases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_submissions ENABLE ROW LEVEL SECURITY;

-- Statements are public while the contest is visible; hidden tests are not exposed to any client role.
DROP POLICY IF EXISTS "coding problems read" ON public.coding_problems;
CREATE POLICY "coding problems read" ON public.coding_problems FOR SELECT TO anon, authenticated
  USING (active AND EXISTS (SELECT 1 FROM public.contests c WHERE c.id = contest_id AND c.active));
DROP POLICY IF EXISTS "coding submissions own read" ON public.coding_submissions;
CREATE POLICY "coding submissions own read" ON public.coding_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.coding_problems, public.coding_testcases, public.coding_submissions FROM anon, authenticated;
GRANT SELECT ON public.coding_problems TO anon, authenticated;
GRANT SELECT ON public.coding_submissions TO authenticated;
GRANT ALL ON public.coding_problems, public.coding_testcases, public.coding_submissions TO service_role;
