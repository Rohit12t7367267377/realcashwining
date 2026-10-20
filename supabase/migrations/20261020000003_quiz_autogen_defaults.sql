-- Turns the automatic free quiz-contest engine on with a sensible rotation, so contests appear without
-- manual setup. Admin can change or switch it off any time in Admin > Contests. Never overwrites an
-- existing admin-saved configuration.
INSERT INTO public.app_settings (key, value) VALUES ('quiz_autogen', $json$
{
  "enabled": true, "intervalMinutes": 60, "publishMode": "auto", "questionCount": 10, "durationMinutes": 15,
  "maxParticipants": 5000, "startsAfterMinutes": 10, "openForMinutes": 240, "maxAttempts": 3,
  "scopes": [
    {"track":"school","board":"UP Board","className":"10","subject":"Science","topic":"","difficulty":"medium","language":"en"},
    {"track":"exam","board":"SSC CGL","className":"Tier 1","subject":"Quantitative Aptitude","topic":"","difficulty":"medium","language":"en","examPreset":"ssc-cgl","questionCount":10,"durationMinutes":12,"marksCorrect":2,"marksWrong":-0.5},
    {"track":"school","board":"CBSE","className":"12","subject":"Physics","topic":"","difficulty":"medium","language":"en"},
    {"track":"college","board":"B.Tech","className":"Semester 3","subject":"Data Structures and Algorithms","topic":"","difficulty":"medium","language":"en"},
    {"track":"exam","board":"JEE Main","className":"Paper 1","subject":"Chemistry","topic":"","difficulty":"hard","language":"en","examPreset":"jee-main","questionCount":10,"durationMinutes":20,"marksCorrect":4,"marksWrong":-1},
    {"track":"school","board":"UP Board","className":"11","subject":"Mathematics","topic":"","difficulty":"medium","language":"en"},
    {"track":"exam","board":"NEET","className":"Paper","subject":"Biology","topic":"","difficulty":"medium","language":"en","examPreset":"neet","questionCount":10,"durationMinutes":12,"marksCorrect":4,"marksWrong":-1},
    {"track":"college","board":"B.Tech","className":"Semester 4","subject":"Operating Systems","topic":"","difficulty":"medium","language":"en"}
  ]
}
$json$::jsonb) ON CONFLICT (key) DO NOTHING;
