-- 1. Knowledge sources / API providers (server-only: secrets never leave the backend)
CREATE TABLE IF NOT EXISTS public.guru_knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  label text NOT NULL,
  source_type text NOT NULL DEFAULT 'content_api',
  endpoint text,
  description text,
  api_key_secret_name text,
  api_key text,
  api_secret text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'not_configured',
  enabled boolean NOT NULL DEFAULT false,
  last_tested_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.guru_knowledge_sources TO service_role;
ALTER TABLE public.guru_knowledge_sources ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies and no anon/authenticated grants: credentials are
-- reachable only through trusted server-side code.

CREATE TRIGGER guru_knowledge_sources_touch BEFORE UPDATE ON public.guru_knowledge_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Galaxy Classroom worlds
CREATE TABLE IF NOT EXISTS public.guru_classrooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  planet text,
  subject text,
  environment text NOT NULL DEFAULT 'space',
  theme_color text,
  description text,
  character_id uuid REFERENCES public.guru_characters(id) ON DELETE SET NULL,
  board text,
  class_name text,
  degree text,
  exam text,
  is_premium boolean NOT NULL DEFAULT false,
  xp_reward integer NOT NULL DEFAULT 50,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guru_classrooms TO authenticated;
GRANT ALL ON public.guru_classrooms TO service_role;
ALTER TABLE public.guru_classrooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in students read active classrooms"
  ON public.guru_classrooms FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "Admins manage classrooms"
  ON public.guru_classrooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER guru_classrooms_touch BEFORE UPDATE ON public.guru_classrooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Personalised learning memory
CREATE TABLE IF NOT EXISTS public.guru_learning_memory (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_language text NOT NULL DEFAULT 'en',
  preferred_character_id uuid REFERENCES public.guru_characters(id) ON DELETE SET NULL,
  preferred_teaching_style text,
  skill_level text NOT NULL DEFAULT 'beginner',
  topics_studied jsonb NOT NULL DEFAULT '[]'::jsonb,
  topics_completed jsonb NOT NULL DEFAULT '[]'::jsonb,
  weak_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  strong_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  quiz_performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  difficulty_performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  learning_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.guru_learning_memory TO authenticated;
GRANT ALL ON public.guru_learning_memory TO service_role;
ALTER TABLE public.guru_learning_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage their own learning memory"
  ON public.guru_learning_memory FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER guru_learning_memory_touch BEFORE UPDATE ON public.guru_learning_memory
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Admin audit log
CREATE TABLE IF NOT EXISTS public.guru_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.guru_audit_logs TO authenticated;
GRANT ALL ON public.guru_audit_logs TO service_role;
ALTER TABLE public.guru_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs"
  ON public.guru_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));