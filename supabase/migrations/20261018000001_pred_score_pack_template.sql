-- Score-only contest: settles from the verified match score alone (no ball-by-ball data needed).
-- Six questions: winner, innings 1 / 2 runs, innings 1 / 2 wickets, combined match runs.
-- Created automatically 3h before the match, locks 5 min before the start, 13 virtual points to join,
-- +2 correct / -1 wrong / 0 unanswered, winner takes 70% of the entry pool (virtual points only).
INSERT INTO public.pred_templates
  (category_id, name, description, sport, formats, plan, timing, scoring, participant_limit,
   entry_fee, min_participants, prize_split, auto_generate, require_approval, allow_edit, enabled)
SELECT c.id, 'Score pack · winner, runs, wickets',
  'Predict the winner, each innings total, each innings wickets and the combined runs. Settled from the verified final score. +2 correct, -1 wrong, 0 unanswered. Virtual points only.',
  'cricket', ARRAY['t20','t10','odi'],
  '{"generator":"score_pack"}'::jsonb,
  '{"trigger":"pre_match","createBeforeMin":180,"opensBeforeMin":180,"locksBeforeMin":5,"lockAfterMin":5,"catchUp":"shorten","minOpenMin":5}'::jsonb,
  '{"pointsPerCorrect":2,"negativePerWrong":1}'::jsonb, NULL,
  13, 2, '[70]'::jsonb, true, false, false, true
FROM (SELECT id FROM public.pred_categories WHERE key = 'match_winner' LIMIT 1) c
WHERE NOT EXISTS (SELECT 1 FROM public.pred_templates t WHERE t.name = 'Score pack · winner, runs, wickets');
