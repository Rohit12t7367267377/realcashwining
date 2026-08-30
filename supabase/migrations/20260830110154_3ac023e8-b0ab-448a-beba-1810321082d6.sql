-- 1. Voice catalogue
CREATE TABLE public.guru_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  provider text NOT NULL DEFAULT 'lovable',
  voice_id text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  accent text,
  gender text,
  speed numeric NOT NULL DEFAULT 1.0,
  pitch numeric NOT NULL DEFAULT 1.0,
  style text,
  is_default boolean NOT NULL DEFAULT false,
  is_fallback boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_voices TO authenticated;
GRANT ALL ON public.guru_voices TO service_role;
ALTER TABLE public.guru_voices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_voices read active" ON public.guru_voices FOR SELECT TO authenticated USING (active = true);
CREATE TRIGGER guru_voices_touch BEFORE UPDATE ON public.guru_voices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.guru_voices (code, label, provider, voice_id, language, gender, speed, style, is_default, is_fallback, sort_order) VALUES
  ('alloy',   'Alloy — neutral',        'lovable', 'alloy',   'en', 'neutral', 1.0, 'balanced',  true,  true, 1),
  ('nova',    'Nova — bright female',   'lovable', 'nova',    'en', 'female',  1.0, 'bright',    false, false, 2),
  ('shimmer', 'Shimmer — soft female',  'lovable', 'shimmer', 'en', 'female',  0.95,'gentle',    false, false, 3),
  ('echo',    'Echo — steady male',     'lovable', 'echo',    'en', 'male',    1.0, 'steady',    false, false, 4),
  ('onyx',    'Onyx — deep male',       'lovable', 'onyx',    'en', 'male',    0.95,'deep',      false, false, 5),
  ('fable',   'Fable — storyteller',    'lovable', 'fable',   'en', 'neutral', 1.0, 'narrative', false, false, 6);

-- 2. Per-teacher voice settings
ALTER TABLE public.guru_characters
  ADD COLUMN IF NOT EXISTS voice_provider text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS voice_code text,
  ADD COLUMN IF NOT EXISTS fallback_voice_code text,
  ADD COLUMN IF NOT EXISTS voice_speed numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS voice_pitch numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS voice_language text NOT NULL DEFAULT 'en';

UPDATE public.guru_characters SET voice_code = v.code
FROM (VALUES
  ('maths_teacher','echo'),('physics_teacher','nova'),('chem_teacher','fable'),
  ('bio_teacher','shimmer'),('cs_teacher','nova'),('code_mentor','echo'),
  ('ai_mentor','alloy'),('english_teacher','shimmer'),('language_teacher','nova'),
  ('exam_mentor','onyx'),('college_mentor','onyx'),('career_mentor','fable'),
  ('gen_teacher','alloy')
) AS v(code_key, code)
WHERE public.guru_characters.code = v.code_key AND public.guru_characters.voice_code IS NULL;

UPDATE public.guru_characters SET voice_code = 'alloy' WHERE voice_code IS NULL;
UPDATE public.guru_characters SET fallback_voice_code = 'alloy' WHERE fallback_voice_code IS NULL;

-- 3. Student voice preferences
ALTER TABLE public.guru_student_xp
  ADD COLUMN IF NOT EXISTS preferred_voice_code text,
  ADD COLUMN IF NOT EXISTS preferred_voice_speed numeric NOT NULL DEFAULT 1.0;

-- 4. Admin teaching configuration used by every education module
CREATE TABLE public.guru_teaching_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  ref_id uuid,
  topic_key text,
  title text NOT NULL,
  character_id uuid REFERENCES public.guru_characters(id) ON DELETE SET NULL,
  voice_code text,
  teaching_mode text NOT NULL DEFAULT 'interactive',
  board_type text NOT NULL DEFAULT 'whiteboard',
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  lesson_structure jsonb NOT NULL DEFAULT '[]'::jsonb,
  difficulty text,
  language text NOT NULL DEFAULT 'en',
  access text NOT NULL DEFAULT 'free',
  extra_instructions text,
  active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guru_teaching_configs_lookup ON public.guru_teaching_configs (scope, ref_id);
CREATE INDEX guru_teaching_configs_topic ON public.guru_teaching_configs (scope, lower(topic_key));
GRANT SELECT ON public.guru_teaching_configs TO authenticated;
GRANT ALL ON public.guru_teaching_configs TO service_role;
ALTER TABLE public.guru_teaching_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_teaching_configs read active" ON public.guru_teaching_configs FOR SELECT TO authenticated USING (active = true);
CREATE TRIGGER guru_teaching_configs_touch BEFORE UPDATE ON public.guru_teaching_configs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();