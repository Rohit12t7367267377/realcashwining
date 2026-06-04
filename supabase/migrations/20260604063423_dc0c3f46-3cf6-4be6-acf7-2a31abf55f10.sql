
-- Add more sports categories
INSERT INTO public.categories (name, slug, icon, description, sort_order, active) VALUES
  ('Tennis', 'tennis', '🎾', 'Live tennis match quizzes', 51, true),
  ('Basketball', 'basketball', '🏀', 'Live basketball match quizzes', 52, true),
  ('Badminton', 'badminton', '🏸', 'Live badminton match quizzes', 53, true),
  ('Hockey', 'hockey', '🏑', 'Live hockey match quizzes', 54, true),
  ('Kabaddi', 'kabaddi', '🤼', 'Live kabaddi match quizzes', 55, true),
  ('Other Sports', 'sports-other', '🏆', 'Other live sports quizzes', 56, true)
ON CONFLICT DO NOTHING;

-- Anti-cheat: track contest attempts (one per user per contest)
CREATE TABLE public.contest_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contest_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  score numeric DEFAULT 0,
  violations integer NOT NULL DEFAULT 0,
  device_fingerprint text,
  ip_address text,
  status text NOT NULL DEFAULT 'in_progress',
  UNIQUE (user_id, contest_id)
);

GRANT SELECT, INSERT, UPDATE ON public.contest_attempts TO authenticated;
GRANT ALL ON public.contest_attempts TO service_role;

ALTER TABLE public.contest_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attempts self read" ON public.contest_attempts
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "attempts self insert" ON public.contest_attempts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "attempts self update" ON public.contest_attempts
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "attempts admin read" ON public.contest_attempts
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_contest_attempts_contest ON public.contest_attempts(contest_id);
CREATE INDEX idx_contest_attempts_user ON public.contest_attempts(user_id);
