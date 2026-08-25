CREATE TABLE IF NOT EXISTS public.guru_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  publisher text,
  isbn text,
  description text,
  cover_url text,
  language text NOT NULL DEFAULT 'en',
  resource_type text NOT NULL DEFAULT 'book',
  board text,
  class_name text,
  degree text,
  semester text,
  subject text,
  chapter text,
  topic text,
  exam text,
  source_name text,
  source_url text,
  license text,
  access_type text NOT NULL DEFAULT 'free',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'published',
  active boolean NOT NULL DEFAULT true,
  content text,
  chunk_count integer NOT NULL DEFAULT 0,
  indexed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guru_resources_type_idx ON public.guru_resources (resource_type);
CREATE INDEX IF NOT EXISTS guru_resources_filters_idx ON public.guru_resources (board, class_name, subject, exam, degree, language);

GRANT SELECT ON public.guru_resources TO authenticated;
GRANT ALL ON public.guru_resources TO service_role;

ALTER TABLE public.guru_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users read published resources"
  ON public.guru_resources FOR SELECT TO authenticated
  USING (active = true AND status = 'published');

CREATE POLICY "Admins manage resources"
  ON public.guru_resources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER guru_resources_touch BEFORE UPDATE ON public.guru_resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.guru_ai_sources
  ADD COLUMN IF NOT EXISTS resource_id uuid REFERENCES public.guru_resources(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS guru_ai_sources_resource_idx ON public.guru_ai_sources (resource_id);

INSERT INTO public.guru_resources (title, author, publisher, description, language, resource_type, board, class_name, subject, exam, degree, source_name, source_url, license, access_type, tags, status, sort_order)
VALUES
  ('NCERT Textbooks (Class 1–12)', 'NCERT', 'NCERT', 'Official NCERT textbooks for all classes and subjects, published free of cost by NCERT on ePathshala.', 'en', 'book', 'CBSE', 'Class 1-12', 'All Subjects', NULL, NULL, 'NCERT ePathshala', 'https://ncert.nic.in/textbook.php', 'Free official government publication', 'free', ARRAY['ncert','textbook','cbse','school'], 'published', 1),
  ('NCERT पाठ्यपुस्तकें (कक्षा 1–12)', 'NCERT', 'NCERT', 'हिंदी माध्यम की आधिकारिक NCERT पाठ्यपुस्तकें, ePathshala पर निःशुल्क उपलब्ध।', 'hi', 'book', 'CBSE', 'Class 1-12', 'All Subjects', NULL, NULL, 'NCERT ePathshala', 'https://epathshala.nic.in/', 'Free official government publication', 'free', ARRAY['ncert','hindi','textbook'], 'published', 2),
  ('NIOS Open Schooling Study Material', 'NIOS', 'National Institute of Open Schooling', 'Free self-learning study material for secondary and senior secondary open schooling.', 'en', 'study', NULL, 'Class 10-12', 'All Subjects', NULL, NULL, 'NIOS', 'https://www.nios.ac.in/online-course-material.aspx', 'Free official government publication', 'free', ARRAY['nios','open schooling','study material'], 'published', 3),
  ('OpenStax College Physics', 'OpenStax', 'Rice University', 'Peer-reviewed, openly licensed college physics textbook covering mechanics, thermodynamics, waves and modern physics.', 'en', 'book', NULL, NULL, 'Physics', 'JEE Main', 'B.Sc', 'OpenStax', 'https://openstax.org/details/books/college-physics-2e', 'CC BY 4.0', 'free', ARRAY['openstax','physics','open textbook'], 'published', 4),
  ('OpenStax Calculus (Volumes 1–3)', 'OpenStax', 'Rice University', 'Openly licensed calculus textbook series: limits, derivatives, integration, sequences, series and multivariable calculus.', 'en', 'book', NULL, NULL, 'Mathematics', 'GATE', 'B.Tech', 'OpenStax', 'https://openstax.org/details/books/calculus-volume-1', 'CC BY-NC-SA 4.0', 'free', ARRAY['openstax','maths','calculus'], 'published', 5),
  ('OpenStax Biology 2e', 'OpenStax', 'Rice University', 'Open biology textbook covering cell biology, genetics, evolution, plant and animal physiology.', 'en', 'book', NULL, NULL, 'Biology', 'NEET', 'B.Sc', 'OpenStax', 'https://openstax.org/details/books/biology-2e', 'CC BY 4.0', 'free', ARRAY['openstax','biology','neet'], 'published', 6),
  ('NPTEL Course Notes & Lectures', 'IIT / IISc Faculty', 'NPTEL', 'Free engineering and science course notes, transcripts and video lectures from IITs and IISc.', 'en', 'reference', NULL, NULL, 'Engineering', 'GATE', 'B.Tech', 'NPTEL', 'https://nptel.ac.in/courses', 'Free for educational use (NPTEL terms)', 'free', ARRAY['nptel','engineering','lectures'], 'published', 7),
  ('SWAYAM Open Courses', 'Government of India', 'MoE SWAYAM', 'Free online courses with notes and assignments for school, college and competitive-exam learners.', 'en', 'study', NULL, NULL, 'All Subjects', NULL, NULL, 'SWAYAM', 'https://swayam.gov.in/', 'Free official government platform', 'free', ARRAY['swayam','mooc','courses'], 'published', 8),
  ('National Digital Library of India', 'NDLI', 'IIT Kharagpur', 'Aggregated access to lakhs of openly available books, notes and question papers across classes, degrees and exams.', 'en', 'reference', NULL, NULL, 'All Subjects', NULL, NULL, 'NDLI', 'https://ndl.iitkgp.ac.in/', 'Aggregator of openly accessible resources', 'free', ARRAY['ndli','library','open access'], 'published', 9),
  ('Project Gutenberg Classics', 'Various', 'Project Gutenberg', 'Public-domain literature for English reading, comprehension and literature papers.', 'en', 'book', NULL, NULL, 'English', 'CUET', 'BA', 'Project Gutenberg', 'https://www.gutenberg.org/', 'Public domain', 'free', ARRAY['gutenberg','literature','public domain'], 'published', 10);