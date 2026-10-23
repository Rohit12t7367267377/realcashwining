-- More teacher voices (female / male / neutral, English + Hindi-friendly). Safe to run more than once.
-- Voice ids are the gateway TTS voices; the same voices speak Hindi too.
INSERT INTO public.guru_voices (code, label, provider, voice_id, language, accent, gender, speed, style, is_default, is_fallback, sort_order, active) VALUES
  ('coral',      'Coral — warm female',          'lovable', 'coral',   'en', 'neutral', 'female',  1.0,  'warm',        false, false, 7,  true),
  ('sage',       'Sage — calm female',           'lovable', 'sage',    'en', 'neutral', 'female',  0.95, 'calm',        false, false, 8,  true),
  ('ash',        'Ash — friendly male',          'lovable', 'ash',     'en', 'neutral', 'male',    1.0,  'friendly',    false, false, 9,  true),
  ('verse',      'Verse — expressive male',      'lovable', 'verse',   'en', 'neutral', 'male',    1.0,  'expressive',  false, false, 10, true),
  ('ballad',     'Ballad — gentle storyteller',  'lovable', 'ballad',  'en', 'neutral', 'neutral', 0.95, 'gentle',      false, false, 11, true),
  ('hi_nova',    'Hindi — Nova (female)',        'lovable', 'nova',    'hi', 'Indian',  'female',  0.95, 'bright',      false, false, 20, true),
  ('hi_shimmer', 'Hindi — Shimmer (female)',     'lovable', 'shimmer', 'hi', 'Indian',  'female',  0.95, 'gentle',      false, false, 21, true),
  ('hi_coral',   'Hindi — Coral (female)',       'lovable', 'coral',   'hi', 'Indian',  'female',  0.95, 'warm',        false, false, 22, true),
  ('hi_echo',    'Hindi — Echo (male)',          'lovable', 'echo',    'hi', 'Indian',  'male',    0.95, 'steady',      false, false, 23, true),
  ('hi_onyx',    'Hindi — Onyx (deep male)',     'lovable', 'onyx',    'hi', 'Indian',  'male',    0.95, 'deep',        false, false, 24, true),
  ('hi_ash',     'Hindi — Ash (male)',           'lovable', 'ash',     'hi', 'Indian',  'male',    0.95, 'friendly',    false, false, 25, true),
  ('slow_nova',  'Slow & clear — Nova (female)', 'lovable', 'nova',    'en', 'neutral', 'female',  0.85, 'slow-clear',  false, false, 30, true),
  ('slow_echo',  'Slow & clear — Echo (male)',   'lovable', 'echo',    'en', 'neutral', 'male',    0.85, 'slow-clear',  false, false, 31, true)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label, voice_id = EXCLUDED.voice_id, language = EXCLUDED.language, accent = EXCLUDED.accent,
  gender = EXCLUDED.gender, speed = EXCLUDED.speed, style = EXCLUDED.style, sort_order = EXCLUDED.sort_order, active = true;
