# Automated sports and quiz contest engine

## Existing foundations
- Reuse the cricket match cache, sports administration page, match-linked contests, AI draft review, atomic contest entry, declared-result leaderboards, existing points, and notification infrastructure.
- Keep real-money wallet functionality unchanged. New prediction/fantasy features will use separate virtual points only.

## First implementation increment
- Centralize cricket ingestion behind a typed provider adapter; route legacy and current refresh actions through it.
- Normalize match statuses, teams, UTC dates, and innings without inventing missing scores or statistics.
- Add bounded timeout/retry behavior, redirect rejection, safe errors, and stored provider synchronization health.
- Make scheduled sports passes synchronize the provider rather than merely reading old cached matches.
- Show provider health in existing sports administration and clearly identify stale scores on cricket pages.
- Test normalization, malformed payloads, status transitions, retries, and unavailable data.

## Following increments
1. Configurable templates, automatic free contest generation, unique generation keys, publication approval, and question locks.
2. Verified event matching, transactional settlement/corrections, deterministic ranks, and separate virtual reward ledger.
3. Scorecards/events where the provider supports them, notification deduplication, job checkpoints, monitoring, and retries.
4. Complete admin controls and full simulated match lifecycle, then real-provider checks before production scheduling.

## Dependencies and limits
- A cricket credential is saved, but its current validity and ball-by-ball entitlement need verification.
- Database scheduling is not currently installed. Do not enable new live automation or publish until its provider and schedule are verified.
- Existing category-wide question selection and generic cash settlement cannot safely serve prediction contests; isolate the new template/event settlement path before enabling it.
- The current feed does not establish authorized access to ball-by-ball data, player statistics, or other sports.