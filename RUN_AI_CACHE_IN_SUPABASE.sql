-- Server-side cache of AI-built syllabus lists so chapters/topics load instantly and keep working if the AI is unavailable.
CREATE TABLE IF NOT EXISTS public.school_syllabus_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('chapters','topics')),
  board text NOT NULL,
  class_name text NOT NULL,
  subject text NOT NULL,
  chapter text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  items jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, board, class_name, subject, chapter, language)
);
ALTER TABLE public.school_syllabus_cache ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.school_syllabus_cache TO service_role;
-- No policies on purpose: only the server (service role) reads and writes this table.
-- Backend store for AI-generated lessons, notes, quizzes and outlines so identical requests never call the AI twice.
CREATE TABLE IF NOT EXISTS public.ai_content_cache (
  cache_key text PRIMARY KEY,
  kind text NOT NULL,
  response text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_content_cache_kind_idx ON public.ai_content_cache (kind, created_at DESC);
ALTER TABLE public.ai_content_cache ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_content_cache TO service_role;
-- No policies on purpose: only the server (service role) reads and writes this table.
