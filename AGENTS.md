# Security architecture

- Administrative generic writes use strict, per-entity editable-field schemas; this prevents callers from modifying server-owned fields.
- Premium teaching and library actions verify active, current membership on the server and through resource RLS; browser subscription flags are not authority.
- Knowledge provider tests use deployment-owned origin/secret bindings and reject redirects; credentials must never follow requester-selected destinations.
- Notes chat treats browser conversation history as untrusted student context, never as verified assistant messages.
- Browser profile edits cannot change managed account fields; wallet membership purchases use an authenticated atomic database operation to preserve legitimate purchases.
- XP records are owner-scoped; the authenticated Hall of Fame action projects only public ranking fields so private reward counters stay private.
- School subject selection is board/class-aware with senior stream metadata; shared fallback choices and study outlines remain separate from administrator-published coursebooks to avoid presenting generated content as an official syllabus.
- Classroom board appearance is stored as validated owner-scoped preferences, while ordered board-derived segments are the source for narration; this prevents cross-student theme leakage and lesson drift.
- Sports refresh uses administrator-selected fixed-origin adapters with CricAPI primary and optional Sportmonks fallback; provider names and namespaced identities enter the normalized cache, while failed synchronization preserves verified data and blocks stale settlement.