-- AI Doubt Assistant chat history + AI config keys
CREATE TABLE public.ai_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_chat_messages_user_created_idx ON public.ai_chat_messages(user_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.ai_chat_messages TO authenticated;
GRANT ALL ON public.ai_chat_messages TO service_role;

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own AI chat" ON public.ai_chat_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own AI chat" ON public.ai_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own AI chat" ON public.ai_chat_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Seed AI feature toggles in app_settings (idempotent)
INSERT INTO public.app_settings (key, value) VALUES
  ('ai_enabled', 'true'::jsonb),
  ('ai_model', '"google/gemini-3-flash-preview"'::jsonb),
  ('ai_gen_enabled', 'true'::jsonb),
  ('ai_recs_enabled', 'true'::jsonb),
  ('ai_doubt_enabled', 'true'::jsonb),
  ('ai_doubt_system_prompt', '"You are a friendly quiz tutor for the Cash Winning League app. Explain concepts clearly and concisely in simple language. If the user asks in Hindi, reply in Hindi. Never reveal answers to active contest questions."'::jsonb)
ON CONFLICT (key) DO NOTHING;