-- More teacher voices (female / male / neutral, English + Hindi-friendly). Safe to run more than once.
INSERT INTO public.guru_voices (code, label, provider, voice_id, language, accent, gender, speed, style, is_default, is_fallback, sort_order, active) VALUES
  ('coral',      'Coral — warm female',          'lovable', 'coral',   'en', 'neutral', 'female', 1.0,  'warm',        false, false, 7,  true),
  ('sage',       'Sage — calm female',           'lovable', 'sage',    'en', 'neutral', 'female', 0.95, 'calm',        false, false, 8,  true),
  ('ash',        'Ash — clear male',             'lovable', 'ash',     'en', 'neutral', 'male',   1.0,  'clear',       false, false, 9,  true),
  ('ballad',     'Ballad — gentle male',         'lovable', 'ballad',  'en', 'neutral', 'male',   0.95, 'gentle',      false, false, 10, true),
  ('verse',      'Verse — expressive',           'lovable', 'verse',   'en', 'neutral', 'other',  1.0,  'expressive',  false, false, 11, true),
  ('nova_hi',    'Nova — Hindi female',          'lovable', 'nova',    'hi', 'indian',  'female', 0.95, 'bright',      false, false, 12, true),
  ('shimmer_hi', 'Shimmer — Hindi soft female',  'lovable', 'shimmer', 'hi', 'indian',  'female', 0.95, 'gentle',      false, false, 13, true),
  ('onyx_hi',    'Onyx — Hindi deep male',       'lovable', 'onyx',    'hi', 'indian',  'male',   0.95, 'deep',        false, false, 14, true),
  ('echo_hi',    'Echo — Hindi steady male',     'lovable', 'echo',    'hi', 'indian',  'male',   0.95, 'steady',      false, false, 15, true),
  ('fable_hi',   'Fable — Hindi storyteller',    'lovable', 'fable',   'hi', 'indian',  'other',  0.95, 'narrative',   false, false, 16, true)
ON CONFLICT (code) DO NOTHING;
