# Guru-G inactive-control audit plan

## Goal
Audit Home, Ranks, Guru.AI, Elite Hub, Profile, and their reachable user-facing sections. Activate unfinished or placeholder controls using existing real functionality, while preserving legitimate authentication, eligibility, premium, progress, and safety gates.

## Work
1. Inventory every interactive control and classify it as working, intentionally gated, or unfinished.
2. Replace dead buttons, placeholder messages, empty handlers, and broken links with the correct existing routes/actions.
3. Fix runtime and navigation errors found during the audit without changing backend configuration or database structure.
4. Verify the five main sections and changed flows at desktop and mobile sizes.

## Guardrails
- Do not bypass legitimate permissions, premium access, contest timing, account verification, or progress requirements.
- Do not use mock data or temporary APIs.
- Preserve existing navigation order, features, authentication, backend, and admin panel.
- No database migration, publishing, or backend configuration changes.

## Technical notes
- Prefer existing routes, server functions, and design-system controls.
- A lock is only removed when the destination/action already exists and is safe; genuine product gates remain, with clearer next actions where appropriate.
- Validate with TypeScript/tests and browser checks for the affected routes.
