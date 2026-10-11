ALTER TABLE public.guru_subjects ADD COLUMN IF NOT EXISTS streams text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.guru_boards ADD COLUMN IF NOT EXISTS syllabus_url text;
COMMENT ON COLUMN public.guru_subjects.streams IS 'Applicable senior-secondary streams; empty means common to every stream. Maintained by administrators.';
COMMENT ON COLUMN public.guru_boards.syllabus_url IS 'Official board curriculum reference; not AI-generated content.';