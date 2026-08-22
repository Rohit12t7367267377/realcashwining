# Guru.AI Implementation Status

## CURRENT STATUS
Phases 0–5 complete. Phase 8 (Skills World) and a first version of Phase 15
(Galaxy Classroom) are now complete. Library (Phase 9) and a Competition Hub
first version (Phase 7/6) are in place.

## Completed phases
- **Phase 0** — existing app untouched; this status file maintained.
- **Phase 1** — Guru.AI dashboard (`src/routes/guru.index.tsx`) with all 9 sections
  wired to real routes, entry link from `/ai`.
- **Phase 2** — characters, costumes, XP, levels, streaks, badges
  (`guru.characters.tsx`, `guru.achievements.tsx`).
- **Phase 3** — School architecture: `guru_boards → academic_years → classes →
  subjects → books → chapters → topics → lessons` (seeded: 5 boards, 60 classes,
  360 subjects/books/chapters/topics/lessons).
- **Phase 4** — School AI Teacher (`guru.topic.$id.tsx`: Learn / Ask Doubt /
  Explain Simply / Practice / Quiz Me / Revise).
- **Phase 5** — Topic mastery + AI-generated tests (`generateTopicTest`,
  `submitTopicTest`, XP + mastery updates).
- **Phase 6/7 (v1)** — `guru.competitions.tsx`: platform contests (read-only),
  Guru XP ranking snapshot, AI practice challenges.
- **Phase 8** — `guru.skills.tsx`: 6 skill tracks × 4 levels, AI lesson
  (Learn / Explain simply / Revise), 5-question AI assessment with XP award.
- **Phase 9 (v1)** — `guru.library.tsx`: book search, chapters, jump into topics.
- **Phase 10 (v1)** — `guru.universal.tsx` universal AI chat.
- **Phase 15 (v1)** — `guru.galaxy.tsx`: each subject is a planet whose glow is
  the student's mastery; empty/loading/error states.
- **Phase 16 (v1)** — `guru.progress.tsx` strong/weak topics.

## Files created (Guru.AI only)
- `src/lib/guru.server.ts`, `src/lib/guru.functions.ts`
- `src/lib/guru-hub.ts`, `src/lib/guru-hub.functions.ts`
- Routes: `guru.tsx`, `guru.index.tsx`, `guru.characters.tsx`, `guru.school.tsx`,
  `guru.topic.$id.tsx`, `guru.universal.tsx`, `guru.progress.tsx`,
  `guru.achievements.tsx`, `guru.library.tsx`, `guru.competitions.tsx`,
  `guru.skills.tsx`, `guru.galaxy.tsx`

## Database tables created
`guru_characters`, `guru_character_costumes`, `guru_character_inventory`,
`guru_character_progress`, `guru_student_xp`, `guru_badges`, `guru_achievements`,
`guru_boards`, `guru_academic_years`, `guru_classes`, `guru_subjects`,
`guru_books`, `guru_chapters`, `guru_topics`, `guru_lessons`,
`guru_student_topic_progress`, `guru_learning_sessions`, `guru_ai_sessions`,
`guru_ai_messages` — all with own-row RLS.

## Integrations completed
- Lovable AI (chat + question generation) through `src/lib/ai-gateway.server.ts`,
  with a safe offline fallback when no key is present.

## Integrations still required
- Embeddings + vector store (Phase 11 RAG)
- Web search provider (Phase 12)
- Vision provider for image doubts (Phase 13)
- STT/TTS provider abstraction for voice tutor (Phase 14)

## Known issues
- Skills tracks are a code catalogue (`src/lib/guru-hub.ts`), not yet admin-managed
  tables (`guru_skill_*`).
- Competition Hub has no dedicated `guru_competitive_exams` / `guru_mock_tests`
  tables yet; it reuses platform contests read-only.
- No Guru.AI Admin Center routes yet (Phase 17).

## NEXT ACTION
Phase 11 — RAG/knowledge retrieval: add `guru_content_chunks` (with embeddings +
board/class/subject/chapter/topic metadata), an EmbeddingProvider abstraction in
`src/lib/guru-rag.server.ts`, chunk-and-embed on lesson save, and retrieval
injected into `guruTeach` before generation.

## REMAINING TASKS
Phase 11 RAG → Phase 12 web search → Phase 13 image doubt → Phase 14 voice AI →
Phase 7 full Competition Hub tables (exams/years/subjects/mock tests) →
Phase 8 admin-managed skill tables → Phase 17 Guru.AI Admin Center.
