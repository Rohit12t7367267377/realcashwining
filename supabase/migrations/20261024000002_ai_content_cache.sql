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
