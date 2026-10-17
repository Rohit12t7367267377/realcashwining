-- Free-to-play "every ball" contests: all overs x 6 balls, four options per ball,
-- +5 for a correct pick and -1 for a wrong pick. Virtual points only.
--
-- Both templates are DISABLED on purpose. They settle from ball-by-ball data, so an admin must first
-- confirm the provider feed (Admin -> Prediction Engine -> Settings -> Test ball feed) and turn on
-- "ball-by-ball" there, then enable these templates.
--
-- Timing (all editable by the admin in the template editor):
--   Innings 1: created 60 min before the match, open immediately, locks 1 min before the first ball.
--   Innings 2: created at the innings break, open immediately, locks 5 min after the break starts.

INSERT INTO public.pred_templates
  (category_id, name, description, sport, formats, plan, timing, scoring, participant_limit, auto_generate, require_approval, enabled)
SELECT c.id, v.name, v.description, 'cricket', ARRAY['t20','t10'], v.plan::jsonb, v.timing::jsonb,
       '{"pointsPerCorrect":5,"negativePerWrong":1}'::jsonb, NULL, true, false, false
FROM (SELECT id FROM public.pred_categories ORDER BY sort_order LIMIT 1) c,
(VALUES
  ('Every ball · Innings 1',
   '+5 for each correct ball, -1 for each wrong one. Unanswered balls score 0.',
   '{"generator":"innings_balls","innings":1}',
   '{"trigger":"pre_match","createBeforeMin":60,"opensBeforeMin":60,"locksBeforeMin":1,"lockAfterMin":5,"catchUp":"shorten","minOpenMin":5}'),
  ('Every ball · Innings 2',
   '+5 for each correct ball, -1 for each wrong one. Unanswered balls score 0.',
   '{"generator":"innings_balls","innings":2}',
   '{"trigger":"innings_break","innings":1,"createBeforeMin":0,"opensBeforeMin":0,"locksBeforeMin":0,"lockAfterMin":5,"catchUp":"shorten","minOpenMin":3}')
) AS v(name, description, plan, timing)
WHERE NOT EXISTS (SELECT 1 FROM public.pred_templates t WHERE t.name = v.name);
