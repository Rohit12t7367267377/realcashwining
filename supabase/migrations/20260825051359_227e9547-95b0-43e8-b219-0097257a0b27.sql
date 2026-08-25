CREATE TABLE public.guru_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  emoji text NOT NULL DEFAULT '🎯',
  blurb text NOT NULL DEFAULT '',
  conducting_body text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_exams TO authenticated;
GRANT ALL ON public.guru_exams TO service_role;
ALTER TABLE public.guru_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exams readable" ON public.guru_exams FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guru_exam_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.guru_exams(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '📘',
  weightage text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_exam_subjects TO authenticated;
GRANT ALL ON public.guru_exam_subjects TO service_role;
ALTER TABLE public.guru_exam_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam subjects readable" ON public.guru_exam_subjects FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guru_exam_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.guru_exam_subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_exam_topics TO authenticated;
GRANT ALL ON public.guru_exam_topics TO service_role;
ALTER TABLE public.guru_exam_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam topics readable" ON public.guru_exam_topics FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guru_college_degrees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  level text NOT NULL DEFAULT 'UG',
  emoji text NOT NULL DEFAULT '🎓',
  blurb text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_college_degrees TO authenticated;
GRANT ALL ON public.guru_college_degrees TO service_role;
ALTER TABLE public.guru_college_degrees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "degrees readable" ON public.guru_college_degrees FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guru_college_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  degree_id uuid NOT NULL REFERENCES public.guru_college_degrees(id) ON DELETE CASCADE,
  name text NOT NULL,
  university text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_college_regulations TO authenticated;
GRANT ALL ON public.guru_college_regulations TO service_role;
ALTER TABLE public.guru_college_regulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regulations readable" ON public.guru_college_regulations FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guru_college_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id uuid NOT NULL REFERENCES public.guru_college_regulations(id) ON DELETE CASCADE,
  term text NOT NULL DEFAULT 'Semester 1',
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  is_programming boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_college_subjects TO authenticated;
GRANT ALL ON public.guru_college_subjects TO service_role;
ALTER TABLE public.guru_college_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "college subjects readable" ON public.guru_college_subjects FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guru_college_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.guru_college_subjects(id) ON DELETE CASCADE,
  unit_number int NOT NULL DEFAULT 1,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_college_units TO authenticated;
GRANT ALL ON public.guru_college_units TO service_role;
ALTER TABLE public.guru_college_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "college units readable" ON public.guru_college_units FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guru_college_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.guru_college_units(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guru_college_topics TO authenticated;
GRANT ALL ON public.guru_college_topics TO service_role;
ALTER TABLE public.guru_college_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "college topics readable" ON public.guru_college_topics FOR SELECT TO authenticated USING (true);

CREATE TABLE public.guru_learn_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  track text NOT NULL,
  node_key text NOT NULL,
  status text NOT NULL DEFAULT 'opened',
  score int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, track, node_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guru_learn_progress TO authenticated;
GRANT ALL ON public.guru_learn_progress TO service_role;
ALTER TABLE public.guru_learn_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own learn progress" ON public.guru_learn_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.guru_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exam_code text NOT NULL,
  subject text NOT NULL DEFAULT '',
  topic text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT 'practice',
  correct int NOT NULL DEFAULT 0,
  total int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.guru_exam_attempts TO authenticated;
GRANT ALL ON public.guru_exam_attempts TO service_role;
ALTER TABLE public.guru_exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own exam attempts read" ON public.guru_exam_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own exam attempts insert" ON public.guru_exam_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

INSERT INTO public.guru_exams (code, name, category, emoji, blurb, conducting_body, sort_order) VALUES
('jee-main','JEE Main','Engineering','🛠️','Entrance to NITs, IIITs & GFTIs and the gateway to JEE Advanced.','NTA',1),
('jee-advanced','JEE Advanced','Engineering','⚙️','The IIT entrance exam for top JEE Main qualifiers.','IIT (rotating)',2),
('gate','GATE','Engineering','📐','Postgraduate engineering entrance and PSU recruitment exam.','IISc & IITs',3),
('neet','NEET','Medical','🩺','All-India medical and dental undergraduate entrance exam.','NTA',4),
('upsc','UPSC Civil Services','Government','🏛️','Prelims, Mains and Interview for IAS, IPS, IFS and allied services.','UPSC',5),
('ssc','SSC (CGL/CHSL)','Government','📋','Staff Selection Commission graduate and higher-secondary level exams.','SSC',6),
('banking','Banking (IBPS/SBI)','Government','🏦','PO and Clerk exams for public sector banks.','IBPS / SBI',7),
('railway','Railway (RRB)','Government','🚆','RRB NTPC, Group D and technical recruitment exams.','RRB',8),
('nda','NDA','Government','🎖️','National Defence Academy entrance for Army, Navy and Air Force.','UPSC',9),
('cds','CDS','Government','🛡️','Combined Defence Services entrance for IMA, INA, AFA and OTA.','UPSC',10),
('cuet','CUET','Other','🎓','Common University Entrance Test for central university admissions.','NTA',11),
('cat','CAT','Other','📊','MBA entrance for IIMs and top B-schools.','IIMs',12),
('clat','CLAT','Other','⚖️','Common Law Admission Test for the National Law Universities.','Consortium of NLUs',13),
('ugc-net','UGC NET','Other','📚','Eligibility test for Assistant Professor and JRF.','NTA',14);

INSERT INTO public.guru_exam_subjects (exam_id, name, emoji, sort_order)
SELECT e.id, s.name, s.emoji, s.ord FROM public.guru_exams e
JOIN (VALUES
 ('jee-main','Physics','🧪',1),('jee-main','Chemistry','⚗️',2),('jee-main','Mathematics','➗',3),
 ('jee-advanced','Physics','🧪',1),('jee-advanced','Chemistry','⚗️',2),('jee-advanced','Mathematics','➗',3),
 ('gate','Engineering Mathematics','➗',1),('gate','General Aptitude','🧠',2),('gate','Core Subject','⚙️',3),
 ('neet','Physics','🧪',1),('neet','Chemistry','⚗️',2),('neet','Biology','🧬',3),
 ('upsc','History','🏺',1),('upsc','Polity & Governance','🏛️',2),('upsc','Geography','🌍',3),('upsc','Economy','💰',4),('upsc','Environment & Ecology','🌱',5),('upsc','Science & Technology','🔬',6),('upsc','Current Affairs','📰',7),('upsc','CSAT Aptitude','🧠',8),
 ('ssc','Quantitative Aptitude','➗',1),('ssc','Reasoning','🧠',2),('ssc','English Language','✍️',3),('ssc','General Awareness','🌍',4),
 ('banking','Quantitative Aptitude','➗',1),('banking','Reasoning Ability','🧠',2),('banking','English Language','✍️',3),('banking','Banking Awareness','🏦',4),('banking','Computer Awareness','💻',5),
 ('railway','Mathematics','➗',1),('railway','General Intelligence & Reasoning','🧠',2),('railway','General Science','🔬',3),('railway','General Awareness','🌍',4),
 ('nda','Mathematics','➗',1),('nda','English','✍️',2),('nda','General Ability','🌍',3),
 ('cds','Mathematics','➗',1),('cds','English','✍️',2),('cds','General Knowledge','🌍',3),
 ('cuet','General Test','🧠',1),('cuet','Language','✍️',2),('cuet','Domain Subjects','📘',3),
 ('cat','Quantitative Ability','➗',1),('cat','VARC','✍️',2),('cat','DILR','📊',3),
 ('clat','Legal Reasoning','⚖️',1),('clat','Logical Reasoning','🧠',2),('clat','English','✍️',3),('clat','Current Affairs & GK','📰',4),('clat','Quantitative Techniques','➗',5),
 ('ugc-net','Teaching Aptitude','👩‍🏫',1),('ugc-net','Research Aptitude','🔬',2),('ugc-net','Paper 2 Subject','📚',3)
) AS s(code, name, emoji, ord) ON s.code = e.code;

INSERT INTO public.guru_college_degrees (code, name, level, emoji, blurb, sort_order) VALUES
('btech','B.Tech','UG','⚙️','Engineering degree across CSE, ECE, ME, CE, EE and more.',1),
('bca','BCA','UG','💻','Computer applications degree with programming focus.',2),
('bsc','B.Sc','UG','🔬','Science degree in Physics, Chemistry, Maths, Biology, CS.',3),
('bcom','B.Com','UG','💰','Commerce degree with accounting, tax and finance.',4),
('ba','BA','UG','📖','Arts degree in History, Political Science, English and more.',5),
('bba','BBA','UG','📈','Business administration and management degree.',6),
('mca','MCA','PG','🖥️','Master of Computer Applications.',7),
('mtech','M.Tech','PG','🧮','Postgraduate engineering specialisation.',8),
('mba','MBA','PG','🏢','Master of Business Administration.',9),
('law','Law (LLB / BA LLB)','UG','⚖️','Law degree with constitutional, criminal and civil law.',10),
('pharmacy','Pharmacy (B.Pharm / D.Pharm)','UG','💊','Pharmaceutical sciences degree.',11),
('nursing','Nursing (B.Sc Nursing / GNM)','UG','🩹','Nursing and patient-care degree.',12),
('msc','M.Sc','PG','🧫','Postgraduate science specialisation.',13),
('bed','B.Ed','UG','👩‍🏫','Teacher education degree.',14),
('bhm','BHM / Hotel Management','UG','🍽️','Hospitality and hotel management degree.',15),
('diploma','Polytechnic Diploma','UG','🔧','Three-year engineering diploma programmes.',16);