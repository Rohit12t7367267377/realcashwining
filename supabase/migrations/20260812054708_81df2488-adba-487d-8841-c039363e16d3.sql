-- ============ CHARACTERS ============
CREATE TABLE public.guru_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  description text,
  avatar_url text,
  emoji text NOT NULL DEFAULT '🤖',
  personality text NOT NULL DEFAULT 'friendly',
  teaching_style text NOT NULL DEFAULT 'step-by-step',
  tone text NOT NULL DEFAULT 'encouraging',
  voice_id text,
  accent_color text NOT NULL DEFAULT '#6d28d9',
  rarity text NOT NULL DEFAULT 'common',
  unlock_type text NOT NULL DEFAULT 'default',
  unlock_requirement jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_characters TO anon, authenticated;
GRANT ALL ON public.guru_characters TO service_role;
ALTER TABLE public.guru_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_characters public read" ON public.guru_characters FOR SELECT USING (true);
CREATE POLICY "guru_characters admin write" ON public.guru_characters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.guru_character_costumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid REFERENCES public.guru_characters(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  image_url text,
  emoji text NOT NULL DEFAULT '🎽',
  rarity text NOT NULL DEFAULT 'common',
  unlock_type text NOT NULL DEFAULT 'default',
  unlock_requirement jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_character_costumes TO anon, authenticated;
GRANT ALL ON public.guru_character_costumes TO service_role;
ALTER TABLE public.guru_character_costumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_costumes public read" ON public.guru_character_costumes FOR SELECT USING (true);
CREATE POLICY "guru_costumes admin write" ON public.guru_character_costumes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.guru_character_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid REFERENCES public.guru_characters(id) ON DELETE CASCADE,
  costume_id uuid REFERENCES public.guru_character_costumes(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'character',
  source text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX guru_inv_char_uniq ON public.guru_character_inventory(user_id, character_id) WHERE character_id IS NOT NULL;
CREATE UNIQUE INDEX guru_inv_costume_uniq ON public.guru_character_inventory(user_id, costume_id) WHERE costume_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guru_character_inventory TO authenticated;
GRANT ALL ON public.guru_character_inventory TO service_role;
ALTER TABLE public.guru_character_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_inv own" ON public.guru_character_inventory FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.guru_character_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid NOT NULL REFERENCES public.guru_characters(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  equipped_costume_id uuid REFERENCES public.guru_character_costumes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, character_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guru_character_progress TO authenticated;
GRANT ALL ON public.guru_character_progress TO service_role;
ALTER TABLE public.guru_character_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_char_progress own" ON public.guru_character_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ STUDENT XP / BADGES ============
CREATE TABLE public.guru_student_xp (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  streak_days integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  selected_character_id uuid REFERENCES public.guru_characters(id) ON DELETE SET NULL,
  preferred_language text NOT NULL DEFAULT 'en',
  board_id uuid,
  class_id uuid,
  lessons_completed integer NOT NULL DEFAULT 0,
  questions_solved integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.guru_student_xp TO authenticated;
GRANT ALL ON public.guru_student_xp TO service_role;
ALTER TABLE public.guru_student_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_student_xp own" ON public.guru_student_xp FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.guru_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  emoji text NOT NULL DEFAULT '🏅',
  tier text NOT NULL DEFAULT 'bronze',
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_xp integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_badges TO anon, authenticated;
GRANT ALL ON public.guru_badges TO service_role;
ALTER TABLE public.guru_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_badges public read" ON public.guru_badges FOR SELECT USING (true);
CREATE POLICY "guru_badges admin write" ON public.guru_badges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.guru_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid REFERENCES public.guru_badges(id) ON DELETE CASCADE,
  code text,
  title text NOT NULL,
  description text,
  progress integer NOT NULL DEFAULT 0,
  goal integer NOT NULL DEFAULT 1,
  earned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.guru_achievements TO authenticated;
GRANT ALL ON public.guru_achievements TO service_role;
ALTER TABLE public.guru_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_achievements own" ON public.guru_achievements FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ SCHOOL CURRICULUM ============
CREATE TABLE public.guru_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text,
  region text,
  description text,
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guru_academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  starts_on date,
  ends_on date,
  is_current boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guru_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES public.guru_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  class_number integer,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guru_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.guru_classes(id) ON DELETE CASCADE,
  board_id uuid REFERENCES public.guru_boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  emoji text NOT NULL DEFAULT '📘',
  language text NOT NULL DEFAULT 'en',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guru_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES public.guru_subjects(id) ON DELETE CASCADE,
  academic_year_id uuid REFERENCES public.guru_academic_years(id) ON DELETE SET NULL,
  title text NOT NULL,
  publisher text,
  language text NOT NULL DEFAULT 'en',
  cover_url text,
  source_reference text,
  version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'published',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guru_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES public.guru_books(id) ON DELETE CASCADE,
  title text NOT NULL,
  chapter_number integer,
  summary text,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'published',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guru_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid REFERENCES public.guru_chapters(id) ON DELETE CASCADE,
  title text NOT NULL,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  difficulty text NOT NULL DEFAULT 'standard',
  estimated_minutes integer NOT NULL DEFAULT 10,
  language text NOT NULL DEFAULT 'en',
  source_reference text,
  version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'published',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.guru_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES public.guru_topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  media_url text,
  kind text NOT NULL DEFAULT 'text',
  language text NOT NULL DEFAULT 'en',
  source_reference text,
  version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'published',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_boards, public.guru_academic_years, public.guru_classes,
  public.guru_subjects, public.guru_books, public.guru_chapters, public.guru_topics,
  public.guru_lessons TO anon, authenticated;
GRANT ALL ON public.guru_boards, public.guru_academic_years, public.guru_classes,
  public.guru_subjects, public.guru_books, public.guru_chapters, public.guru_topics,
  public.guru_lessons TO service_role;
ALTER TABLE public.guru_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guru_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_boards read" ON public.guru_boards FOR SELECT USING (true);
CREATE POLICY "guru_boards admin" ON public.guru_boards FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "guru_years read" ON public.guru_academic_years FOR SELECT USING (true);
CREATE POLICY "guru_years admin" ON public.guru_academic_years FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "guru_classes read" ON public.guru_classes FOR SELECT USING (true);
CREATE POLICY "guru_classes admin" ON public.guru_classes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "guru_subjects read" ON public.guru_subjects FOR SELECT USING (true);
CREATE POLICY "guru_subjects admin" ON public.guru_subjects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "guru_books read" ON public.guru_books FOR SELECT USING (true);
CREATE POLICY "guru_books admin" ON public.guru_books FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "guru_chapters read" ON public.guru_chapters FOR SELECT USING (true);
CREATE POLICY "guru_chapters admin" ON public.guru_chapters FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "guru_topics read" ON public.guru_topics FOR SELECT USING (true);
CREATE POLICY "guru_topics admin" ON public.guru_topics FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "guru_lessons read" ON public.guru_lessons FOR SELECT USING (true);
CREATE POLICY "guru_lessons admin" ON public.guru_lessons FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SESSIONS / PROGRESS ============
CREATE TABLE public.guru_ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid REFERENCES public.guru_characters(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.guru_topics(id) ON DELETE SET NULL,
  scope text NOT NULL DEFAULT 'universal',
  title text,
  language text NOT NULL DEFAULT 'en',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guru_ai_sessions TO authenticated;
GRANT ALL ON public.guru_ai_sessions TO service_role;
ALTER TABLE public.guru_ai_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_sessions own" ON public.guru_ai_sessions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.guru_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.guru_ai_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  intent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.guru_ai_messages TO authenticated;
GRANT ALL ON public.guru_ai_messages TO service_role;
ALTER TABLE public.guru_ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_messages own" ON public.guru_ai_messages FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.guru_learning_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.guru_topics(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES public.guru_lessons(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'learn',
  seconds_spent integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  xp_earned integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.guru_learning_sessions TO authenticated;
GRANT ALL ON public.guru_learning_sessions TO service_role;
ALTER TABLE public.guru_learning_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_learning own" ON public.guru_learning_sessions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.guru_student_topic_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.guru_topics(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  mastery integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id)
);
GRANT SELECT, INSERT, UPDATE ON public.guru_student_topic_progress TO authenticated;
GRANT ALL ON public.guru_student_topic_progress TO service_role;
ALTER TABLE public.guru_student_topic_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guru_topic_progress own" ON public.guru_student_topic_progress FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ TRIGGERS ============
CREATE TRIGGER guru_characters_touch BEFORE UPDATE ON public.guru_characters FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER guru_char_progress_touch BEFORE UPDATE ON public.guru_character_progress FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER guru_student_xp_touch BEFORE UPDATE ON public.guru_student_xp FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER guru_topics_touch BEFORE UPDATE ON public.guru_topics FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER guru_lessons_touch BEFORE UPDATE ON public.guru_lessons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER guru_sessions_touch BEFORE UPDATE ON public.guru_ai_sessions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER guru_topic_progress_touch BEFORE UPDATE ON public.guru_student_topic_progress FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SEED ============
INSERT INTO public.guru_characters (code, name, tagline, description, emoji, personality, teaching_style, tone, accent_color, rarity, unlock_type, unlock_requirement, sort_order) VALUES
('guru-aarav','Aarav','The patient mentor','Explains everything from the basics, one step at a time.','🧑‍🏫','patient','step-by-step','encouraging','#6d28d9','common','default','{}',1),
('guru-meera','Meera','The storyteller','Turns every topic into a memorable story.','👩‍🎓','warm','story-based','friendly','#db2777','common','default','{}',2),
('guru-robo','Robo','The logic engine','Loves formulas, diagrams and clean logic.','🤖','analytical','logic-first','precise','#0ea5e9','common','default','{}',3),
('guru-vidya','Vidya','The exam strategist','Focuses on shortcuts, traps and revision.','👩‍🏫','sharp','exam-focused','motivating','#f59e0b','rare','lessons','{"lessons_completed":25}',4),
('guru-nova','Nova','The space explorer','Teaches science through cosmic adventures.','🚀','curious','discovery','playful','#22c55e','rare','streak','{"streak_days":7}',5),
('guru-codex','Codex','The code sensei','Debugs your thinking as well as your code.','👨‍💻','witty','hands-on','direct','#ef4444','epic','challenges','{"coding_challenges":10}',6);

INSERT INTO public.guru_character_costumes (code, name, description, emoji, rarity, unlock_type, unlock_requirement, sort_order) VALUES
('costume-classic','Classic Kurta','Everyday teaching look.','🧥','common','default','{}',1),
('costume-lab','Lab Coat','For science days.','🥼','common','lessons','{"lessons_completed":5}',2),
('costume-space','Space Suit','Unlocked by a 14-day streak.','👨‍🚀','rare','streak','{"streak_days":14}',3),
('costume-graduate','Graduation Robe','Master 10 chapters.','🎓','rare','mastery','{"chapters_mastered":10}',4),
('costume-champion','Champion Jacket','Win a Guru.AI competition.','🏆','epic','competition','{"competitions_won":1}',5);

INSERT INTO public.guru_badges (code, name, description, emoji, tier, criteria, reward_xp, sort_order) VALUES
('first-lesson','First Steps','Complete your first lesson.','👣','bronze','{"lessons_completed":1}',50,1),
('streak-7','Week Warrior','Keep a 7-day learning streak.','🔥','silver','{"streak_days":7}',150,2),
('streak-30','Unstoppable','Keep a 30-day learning streak.','⚡','gold','{"streak_days":30}',600,3),
('solver-100','Century Solver','Solve 100 questions.','🎯','silver','{"questions_solved":100}',200,4),
('chapter-master','Chapter Master','Master a full chapter.','📗','gold','{"chapters_mastered":1}',300,5),
('coder-10','Code Breaker','Finish 10 coding challenges.','💻','gold','{"coding_challenges":10}',350,6),
('competitor','Competitor','Take part in a Guru.AI competition.','🏆','bronze','{"competitions":1}',100,7);

INSERT INTO public.guru_academic_years (label, is_current) VALUES ('2026-27', true), ('2025-26', false);

INSERT INTO public.guru_boards (code, name, short_name, region, description, sort_order) VALUES
('cbse','Central Board of Secondary Education','CBSE','India','National board following NCERT curriculum.',1),
('icse','Council for the Indian School Certificate Examinations','CISCE/ICSE','India','ICSE and ISC examinations.',2),
('up-board','Uttar Pradesh Board of High School and Intermediate Education','UP Board','Uttar Pradesh','State board of Uttar Pradesh.',3),
('mh-board','Maharashtra State Board of Secondary Education','MSBSHSE','Maharashtra','State board of Maharashtra.',4),
('bihar-board','Bihar School Examination Board','BSEB','Bihar','State board of Bihar.',5);

INSERT INTO public.guru_classes (board_id, name, class_number, sort_order)
SELECT b.id, 'Class ' || n, n, n FROM public.guru_boards b CROSS JOIN generate_series(1,12) AS n;

INSERT INTO public.guru_subjects (class_id, board_id, name, slug, emoji, sort_order)
SELECT c.id, c.board_id, s.name, s.slug, s.emoji, s.ord
FROM public.guru_classes c
CROSS JOIN (VALUES
  ('Mathematics','mathematics','🔢',1),
  ('Science','science','🔬',2),
  ('English','english','🔤',3),
  ('Hindi','hindi','📕',4),
  ('Social Science','social-science','🌏',5),
  ('Computer Science','computer-science','💻',6)
) AS s(name, slug, emoji, ord)
WHERE c.class_number BETWEEN 1 AND 12;

INSERT INTO public.guru_books (subject_id, academic_year_id, title, publisher, source_reference, sort_order)
SELECT s.id, (SELECT id FROM public.guru_academic_years WHERE is_current LIMIT 1),
  s.name || ' — ' || c.name || ' Coursebook', 'Board curriculum outline', 'Official syllabus outline (admin-managed)', 1
FROM public.guru_subjects s JOIN public.guru_classes c ON c.id = s.class_id;

INSERT INTO public.guru_chapters (book_id, title, chapter_number, summary, sort_order)
SELECT bk.id, 'Chapter 1 — Getting Started', 1, 'Introductory chapter outline. Admins can add licensed content.', 1
FROM public.guru_books bk;

INSERT INTO public.guru_topics (chapter_id, title, objectives, estimated_minutes, sort_order)
SELECT ch.id, 'Introduction & Key Ideas',
  '["Understand the core idea","Learn the key terms","Solve two simple examples"]'::jsonb, 12, 1
FROM public.guru_chapters ch;

INSERT INTO public.guru_lessons (topic_id, title, body, sort_order)
SELECT t.id, 'Lesson 1 — Basics',
  'This topic outline is ready for your AI teacher. Ask your Guru.AI character to explain it from the beginning, in your language and at your class level.', 1
FROM public.guru_topics t;