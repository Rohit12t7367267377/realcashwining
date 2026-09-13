# Guru-G Admin Control Center

## Goal
Turn the existing admin panel into the secure operational control layer for the whole Guru-G platform without rebuilding the app, removing features, resetting data, changing backend connections, or publishing.

## Audit Summary

The existing app already has substantial coverage:

- 95 database tables with RLS enabled, 23+ database functions, 38+ triggers, and three private storage buckets.
- 98 route files, including 40+ admin pages and broad controls for quizzes, reading, contests, sports, rewards, payments, memberships, creators, community, notifications, and Guru.AI.
- Server-side admin authentication correctly validates the signed-in session and checks the database `admin` role.
- Existing payment webhooks verify signatures, and contest joining uses an atomic database function.

The audit also found critical gaps that prevent calling the current panel production-complete:

- `editor` and `moderator` roles are assignable but have no effective granular backend permissions.
- Most admin actions have no actor attribution or immutable audit record.
- Wallet adjustments, deposit approval, and withdrawal decisions use non-atomic read/change/write flows.
- Generic admin CRUD accepts unrestricted value objects and bypasses domain-specific validation.
- Categories and books still perform some admin writes directly from the browser.
- No consistent rate limiting exists for sensitive admin, finance, reward, coupon, and AI operations.
- Dashboard metrics are limited to four counts and are not an operational dashboard.
- Storage bucket configuration, file limits, and sensitive KYC/payment-proof access are not fully managed as code.
- Direct messages, referrals, support, external live-score configuration, certificates, richer reports, and several requested reward/community controls lack dedicated admin ownership.
- The database linter reports one RLS-enabled table without a policy and eight callable `SECURITY DEFINER` functions requiring explicit review.

## Implementation Sequence

### Phase 1 — Security and Governance Foundation

- Add database-driven roles, custom roles, permissions, and role-permission assignments while preserving existing role rows.
- Introduce `super_admin` safely and prevent self-escalation, removal of the last super admin, and unauthorized role delegation.
- Replace binary admin middleware with permission-aware server middleware that exposes the verified actor ID and role context.
- Add immutable admin audit logs with action, actor, permission, target, result, reason, request metadata, and before/after snapshots.
- Add mandatory reason and confirmation data for destructive, financial, role, security, and entitlement changes.
- Add server-side rate limiting and idempotency protection for sensitive operations.
- Resolve the database linter findings after reviewing every affected function and policy.
- Add a reusable secure admin-action layer so privileged database access is never called without authorization, validation, and audit logging.

### Phase 2 — Financial and High-Risk Integrity

- Replace wallet adjustment, deposit approval, withdrawal payment/rejection, prize award, XP adjustment, coin adjustment, and reward reversal with atomic database transactions/RPCs.
- Record the acting administrator instead of `reviewed_by: null`.
- Enforce allowed status transitions, duplicate-operation prevention, balance invariants, and idempotency keys.
- Add finance permissions, reconciliation views, payment/refund/dispute queues, transaction detail, and auditable adjustment history.
- Preserve Razorpay signature verification and ensure all subscription/entitlement decisions remain server-controlled.
- Add step-up confirmations for high-risk finance operations.

### Phase 3 — Admin Information Architecture and Shared UI

Rebuild the existing admin shell, not the app, into responsive grouped navigation:

1. Dashboard
2. Users
3. Roles & Permissions
4. Home
5. Quiz Management
6. Rewards & Leaderboards
7. Guru.AI
8. Elite Hub
9. Community
10. Courses & Learning
11. Teachers & Creators
12. Contests & Competitions
13. Payments & Wallet
14. Subscriptions & Premium
15. Notifications
16. Reports & Moderation
17. Analytics
18. Storage
19. Integrations & APIs
20. Feature Flags
21. Security Center
22. Audit Logs
23. System Settings

Build reusable production controls for server-side search, filters, sorting, pagination, mobile list views, selection, bulk actions, status badges, detail drawers, confirmations, empty/error/loading states, and permission-aware navigation.

### Phase 4 — Operational Dashboard and Analytics

- Add date filters for today, 7, 30, 90 days, and custom ranges.
- Add real database-backed metrics for users, activity, quizzes, contests, finance, subscriptions, AI, community, rewards, moderation, suspicious activity, storage, integrations, and system health.
- Add configurable charts and drill-down links; never synthesize missing values.
- Use paginated/aggregated server queries and indexes rather than loading raw datasets into the browser.

### Phase 5 — Users, Roles, Security, and Moderation

- Build paginated user search and profile detail with account state, learning, contest, reward, community, AI, subscription, report, and risk history.
- Implement suspend/restrict/ban/session revocation and audited XP/coin/account adjustments.
- Build custom role and permission management with backend enforcement on every admin endpoint.
- Create central report queues, assignment, escalation, resolution, appeals, and moderation history.
- Add Security Center views for anti-cheat events, device bindings, fraud flags, unauthorized attempts, rate limits, and admin actions.

### Phase 6 — Home, Quiz, Learning, and Contest Control

- Preserve and expand current banners, categories, questions, reading passages, contests, results, cricket, and automation screens.
- Add home section ordering, visibility, featuring, announcements, recommendations, discovery configuration, and feature flags.
- Add database-driven quiz lifecycle states, scheduling, versioning, review/approval, archive/restore, duplication, bulk actions, and AI-generated content review.
- Unify School, College, Competitive Exams, subjects, chapters, topics, resources, lessons, previous papers, and learning paths under dedicated CMS sections.
- Add contest permissions, eligibility, schedules, participant limits, disputes, refunds, anti-cheat review, declared results, and prize reconciliation.

### Phase 7 — Rewards and Leaderboards

- Add configurable XP/coin rules, ranks, thresholds, multipliers, limits, reversals, and history.
- Add badges, achievements, missions, events, reward boxes, streaks, milestones, weekly rewards, certificates, themes, avatars, trials, and AI-credit rewards where supported by actual data.
- Add leaderboard definitions, formulas, eligibility, tie-breakers, periods, privacy, snapshots, moderation, and reward configuration.
- Keep leaderboards and awards database-derived; never add fake ranks, winners, balances, or results.

### Phase 8 — Guru.AI Control Center

- Preserve the centralized teaching engine and existing School, College, Exams, Skills, Galaxy, Library, Notes, Photo Doubt, Universal AI, characters, voices, and teaching configuration.
- Add model/provider routing, enabled states, fallback policy, usage limits, cost/credit tracking, safety, and error monitoring without exposing secrets.
- Add versioned secure prompt management, teacher/personality/style management, character/voice availability, language configuration, learning limits, resource authorization, and AI content approval.
- Add AI usage analytics and gateway error visibility using real usage records available to the project.

### Phase 9 — Elite Hub, Community, Creators, and Notifications

- Expand plans, entitlements, subscriptions, coupons, store, orders, premium features, credit packages, and Galaxy environments.
- Expand community moderation for posts, media, comments, follows, creators, verification, reports, and abuse handling.
- Add safe DM report/moderation metadata without giving ordinary moderators unrestricted private-message browsing.
- Add referral program controls and support ticket ownership where the existing flows require them.
- Expand creator/teacher verification, restrictions, content, earnings, reports, and monetization review.
- Consolidate in-app, push, reward, contest, community, AI, and subscription notifications with templates, scheduling, audience controls, cancellation, and delivery history.

### Phase 10 — Storage, Integrations, Configuration, and Versioning

- Add private storage management for books, community media, UPI assets, KYC/payment evidence, and discovered media types.
- Enforce bucket-specific ownership, admin permissions, MIME allowlists, size limits, safe paths, and signed access.
- Add integration health/configuration views that show status and non-secret metadata only.
- Add centralized server-enforced feature flags.
- Add version history and audited rollback for prompts, AI configuration, reward/rank rules, leaderboard formulas, plans, feature flags, and critical settings.

### Phase 11 — Final Discovery, Testing, and Hardening

- Re-scan every route, action, server function, table, RPC, trigger, storage call, integration, and admin page.
- Complete the feature-control matrix: module, feature, action, admin section, permission, API, database object, RLS, audit status, and completion status.
- Test normal user, moderator, specialist admins, admin, and super admin against both UI and directly invoked protected endpoints.
- Test financial concurrency/idempotency, duplicate rewards, contest authorization, entitlement bypass, AI configuration protection, moderation boundaries, and storage access.
- Run database linter, dependency/security scans, focused tests, TypeScript, lint, and production build.
- Verify desktop, tablet, and mobile admin flows in the browser, including errors, empty states, slow states, and permission-denied states.

## Technical Architecture

- All app-internal admin operations remain TanStack `createServerFn` calls protected by permission middleware.
- External webhooks and scheduled callers remain signed/secret-verified public server routes.
- Privileged database access stays server-only and is dynamically loaded after authorization where required.
- Browser checks control visibility only; server authorization and RLS remain the security boundary.
- New public-schema tables include explicit grants followed by RLS and least-privilege policies in the same migration.
- Roles remain in dedicated role tables; permissions will not be stored on profiles or trusted from browser storage.
- Financial and reward changes execute atomically in the database with idempotency and immutable ledger/audit records.
- Sensitive values stay in server-side secrets; the admin UI receives only masked status metadata.
- Existing tables and data are extended safely; no resets, destructive rewrites, mock replacements, or backend connection changes.

## Deliverables

- Full internal feature inventory and admin feature-control matrix.
- Secure RBAC, audit, confirmation, rate-limit, and versioning foundations.
- Complete responsive Admin Control Center covering all discovered manageable features.
- Additive database migrations with RLS, grants, indexes, functions, triggers, and storage policies.
- Final report covering audit findings, created sections, backend/database/security changes, permissions, secret safety, tests, and genuine external blockers.
