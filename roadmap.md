# Roadmap

## Automated sports and quiz contest engine
- [x] Audit current cricket feed, sports admin controls, match-linked contests, question drafts, scoring, notifications, and automation endpoint
- [ ] Centralize normalized provider models, lifecycle states, provider health, and safe synchronization checkpoints
- [ ] Add admin-configurable contest templates and idempotent match-triggered generation
- [ ] Add authoritative event verification, auditable settlement, deterministic rankings, and separate virtual rewards
- [ ] Improve live score detail and stale/reconnecting states from verified provider data
- [ ] Extend admin operations, job visibility/retries, notification controls, and end-to-end simulation tests
- [ ] Enable production scheduling only after the real provider credential and delivery schedule are confirmed

## Learning ecosystem upgrade
- [x] Audit learning routes, classroom/voice flow, content, persistence, progress, search, and admin dependencies
- [x] Enlarge the full interactive classroom board and reduce teacher size without altering navigation
- [x] Add previewable student board settings with authenticated persistence and guest fallback
- [x] Use ordered lesson segments as the shared board/narration source with pause/resume and segment navigation in the full classroom
- [x] Verify signed-in classroom, preferences reload, real voice playback, and responsive layout without browser errors
- [ ] Expand structured content and authorized document reading across existing learning sections
- [ ] Extend accurate interactive visualizations, practice/revision, analytics, and saved study planning
- [ ] Extend unified learning search, accessibility, and performance
- [ ] Verify authoritative curriculum coverage (requires verified, licensed syllabus/material sources; do not invent missing content)

- [x] Remove phone OTP authentication controls while preserving Google/email
- [x] Remove profile reel button while preserving normal posts
- [x] Fix discovered Guru.AI selection errors, including College and long board-name chapter validation
- [x] Add board/class-aware subject choices, senior streams, and verified UP Board 12 PCM selection
- [x] Verify signed-in School chapter navigation, College degree selection, Guru.AI section loading, and profile reel removal; eight regression tests passed
- [ ] Verify every board/class subject combination and current-year syllabus against official documents (blocker: complete authoritative syllabus documents not yet collected; study outlines are labeled, not certified syllabuses)

- [x] Audit all five main sections and reachable subsections for inactive controls and errors
- [x] Activate unfinished controls using existing real functionality without bypassing legitimate gates
- [x] Fix discovered frontend/runtime errors
- [x] Verify all five main sections on desktop and mobile
- [x] Add shared real teacher voice playback with audio-driven lip-sync
- [x] Connect classroom, floating teacher board, and Photo Doubt lessons
- [ ] Verify teacher speech and mouth synchronization on desktop and mobile (prior task; requires real lesson audio playback verification)
