ALTER TABLE public.guru_characters
  ADD COLUMN IF NOT EXISTS subject_specialization text NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS languages text NOT NULL DEFAULT 'English, Hindi',
  ADD COLUMN IF NOT EXISTS voice_label text NOT NULL DEFAULT 'Warm',
  ADD COLUMN IF NOT EXISTS difficulty_style text NOT NULL DEFAULT 'Adaptive',
  ADD COLUMN IF NOT EXISTS avatar_style text NOT NULL DEFAULT 'classic';

ALTER TABLE public.guru_student_xp
  ADD COLUMN IF NOT EXISTS preferred_teaching_style text NOT NULL DEFAULT 'friendly';

INSERT INTO public.guru_characters (code, name, emoji, tagline, personality, teaching_style, tone, accent_color, subject_specialization, languages, voice_label, difficulty_style, avatar_style, unlock_type, unlock_requirement, rarity, sort_order, active)
VALUES
 ('gen_teacher','Guru Anaya','👩‍🏫','Your everyday all-subject teacher.','Warm and patient','Friendly step-by-step','Encouraging','#6366f1','General / All subjects','English, Hindi','Warm female','Adaptive','classic','free','{}'::jsonb,'common',1,true),
 ('maths_teacher','Ravi Sir','➗','Maths made logical, not scary.','Calm and methodical','Concept-focused with worked steps','Clear','#0ea5e9','Mathematics','English, Hindi','Steady male','Builds from basics','maths','free','{}'::jsonb,'common',2,true),
 ('physics_teacher','Dr. Meera','🧲','Physics through real-life intuition.','Curious and precise','Concept-first with experiments','Inquisitive','#f59e0b','Physics','English, Hindi','Bright female','Challenging','science','free','{}'::jsonb,'common',3,true),
 ('chem_teacher','Arjun Sir','⚗️','Reactions, bonds and neat tricks.','Energetic','Exam-focused with mnemonics','Lively','#22c55e','Chemistry','English, Hindi','Energetic male','Exam oriented','science','free','{}'::jsonb,'common',4,true),
 ('bio_teacher','Dr. Kavya','🧬','Biology with diagrams and stories.','Gentle storyteller','Detailed with diagrams','Soothing','#10b981','Biology','English, Hindi','Soft female','Detailed','science','free','{}'::jsonb,'common',5,true),
 ('cs_teacher','Neha Ma''am','🖥️','Computer science from bits to systems.','Structured','Concept-focused','Professional','#8b5cf6','Computer Science','English, Hindi','Crisp female','Structured','tech','free','{}'::jsonb,'common',6,true),
 ('code_mentor','Dev Bhaiya','👨‍💻','Ship code, not just theory.','Practical and blunt','Project-based','Casual','#ef4444','Programming (Java, Python, C++, JS, DSA)','English, Hindi','Casual male','Hands-on','tech','free','{}'::jsonb,'rare',7,true),
 ('ai_mentor','Zara AI','🤖','AI/ML explained without the maths fear.','Futuristic and clear','Intuition then maths','Smart','#06b6d4','AI / Machine Learning / Data Science','English','Synthetic neutral','Deep dive','ai','free','{}'::jsonb,'rare',8,true),
 ('english_teacher','Miss Ophelia','📚','Grammar, writing and confident speech.','Polished and kind','Simple and corrective','Refined','#ec4899','English Language & Literature','English, Hindi','Elegant female','Gradual','language','free','{}'::jsonb,'common',9,true),
 ('language_teacher','Polyglot Pia','🌐','Learn any language, one sentence a day.','Playful','Conversational drills','Cheerful','#f97316','Languages (Hindi, Sanskrit, French, Spanish)','English, Hindi','Playful female','Easy first','language','free','{}'::jsonb,'common',10,true),
 ('exam_mentor','Colonel Vikram','🎯','Strict prep for JEE, NEET, UPSC, SSC.','Disciplined and demanding','Strict exam-focused','Firm','#dc2626','Competitive Exams','English, Hindi','Commanding male','Tough','exam','free','{}'::jsonb,'rare',11,true),
 ('college_mentor','Prof. Iyer','🎓','College subjects, semesters and vivas.','Scholarly','Detailed lecture style','Academic','#0f766e','College / University subjects','English','Deep male','University level','college','free','{}'::jsonb,'rare',12,true),
 ('career_mentor','Coach Simran','🚀','Skills, resume, interviews, career moves.','Motivating','Fast and practical','Upbeat','#a855f7','Skills / Career / Interviews','English, Hindi','Upbeat female','Fast track','career','free','{}'::jsonb,'epic',13,true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  tagline = EXCLUDED.tagline,
  personality = EXCLUDED.personality,
  teaching_style = EXCLUDED.teaching_style,
  tone = EXCLUDED.tone,
  accent_color = EXCLUDED.accent_color,
  subject_specialization = EXCLUDED.subject_specialization,
  languages = EXCLUDED.languages,
  voice_label = EXCLUDED.voice_label,
  difficulty_style = EXCLUDED.difficulty_style,
  avatar_style = EXCLUDED.avatar_style,
  sort_order = EXCLUDED.sort_order,
  active = true;