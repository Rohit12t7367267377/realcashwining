# Free Match Predictions — setup checklist

Free-to-play, virtual points only. No deposits, withdrawals, entry fees or cash prizes.
The existing real-money wallet is untouched; predictions use separate `pred_*` tables.

## What is built (all verified by unit tests with mock fixtures)

- Fixture and status sync through the existing central sports layer (Admin → Cricket API holds the provider key once).
- Contest templates, categories, custom builder, auto-generation, approval mode, catch-up rules, duplicate protection.
- Lifecycle: draft → scheduled → published → locked → settling → completed / cancelled.
- Server-side answer locking, verification from ball-by-ball data, void / abandoned handling, logged corrections with re-scoring.
- Deterministic leaderboards (contest, match, sport, category, overall; daily / weekly / monthly / all-time; friends).
- Idempotent virtual-point rewards with a ledger; in-app alerts in the existing bell and Notifications page.
- Admin: Admin → Prediction Engine (overview and jobs, contests, templates, custom builder, categories and settings, monitoring and audit).
- User pages: `/predict`, `/predict/<contest>`, improved `/live-scores`.

## What is NOT verified yet

Nothing has been run against a real sports provider or a real database. Treat the
integration as unconfigured until steps 1–4 below are done and the test in step 5 passes.

## Steps to go live (in order)

1. **Apply the database migration** `supabase/migrations/20261016000000_pred_engine.sql`
   (Lovable applies migrations from the repo on sync; confirm in Lovable → Cloud → Database that the
   `pred_*` tables exist). It is safe to re-run.
2. **Set the provider key once**: Admin → Cricket API → enter the CricAPI key (optional Sportmonks fallback) and enable sync.
3. **Set the cron secret** `AUTOMATION_CRON_SECRET` (already used by the other automation hooks).
4. **Schedule the tick** every 1–2 minutes with any scheduler (cron-job.org, Supabase pg_cron, GitHub Actions):

   ```
   POST https://gurug.live/api/public/hooks/pred-tick
   Header: x-automation-secret: <AUTOMATION_CRON_SECRET>
   ```
   The tick is idempotent and safe to retry. Nothing depends on a user's phone being open.
5. **Test with a real match**: Admin → Prediction Engine → Overview → "Run full cycle now",
   then check "Recent jobs" and "Provider health". Use "Test ball feed" to confirm the provider
   returns ball-by-ball data before turning on ball-by-ball contests.
6. Decide **Approval mode** (Categories & settings): on = admin approves each contest before it is published.

## Operating notes

- If the provider is down, the last verified score is shown with its timestamp and a stale indicator;
  settlement refuses stale or ambiguous data and waits instead of guessing.
- Completed results change only through Admin → Contests → correct question (logged, re-scores everyone).
- Play Store: contests are free and award virtual points only. Keep it that way, and do not add
  paid entries or cash prizes to this feature.
