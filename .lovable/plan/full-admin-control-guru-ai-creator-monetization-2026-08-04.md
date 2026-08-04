# Full Admin Control + Guru.AI + Creator Monetization

This is a large request, so it ships in batches. Nothing existing gets removed except the items you explicitly asked to move or delete.

## Batch 1 — Navigation, renaming & page cleanup

- Rename the AI tab and page to **Guru.AI** (route stays `/ai`, all labels/titles updated).
- Move **Library (books)** inside Guru.AI as a section; `/books` keeps working but is reached from Guru.AI.
- **Home**: remove Latest Winners and the Leaderboard preview. Upgrade the existing top wallet block into a full wallet control centre: balance, Add Money (UPI + QR), Withdraw, History, KYC status, pending deposit/withdrawal chips.
- **Profile**: remove the wallet block and all wallet shortcuts (history, deposits, withdraw) — wallet lives only on Home.
- **Profile**: remove the standalone KYC tile; add a small badge-style tile next to it for **Creator Status** (monetization progress). KYC only appears once the user is approved for monetization.

## Batch 2 — Admin control centre (one section per app area)

Restructure the admin dashboard into grouped sections matching the app tabs, so every user-facing function has an admin owner:

```text
Admin
├── Home        banners, marquee, categories, live scores, featured contest
├── Ranks       leaderboards, seasonal events, missions, hall of fame, XP
├── Elite Hub   store products, coupons, memberships, reward boxes, prizes
├── Guru.AI     prompts, quiz generation, library/books, voice assistant
├── Profile     users, roles, community moderation, creator/monetization, ads
└── System      wallet approvals, KYC, fraud, feedback, settings, updates
```

New admin pages in this batch:

- **Elite Hub Store**: admin creates products (title, image, description, price in coins/₹, stock, active). Users buy from Elite Hub; orders land in an admin order queue with fulfil/reject.
- **Prize Distribution**: pick a period (week / month / year), see the leaderboard winners for that period, and award a prize (cash to wallet, coins, XP, reward box, or a free-text physical prize). Awards are logged and shown to the winner.

## Batch 3 — Creator platform (Instagram + YouTube style)

- Profile gains creator analytics: post views, watch minutes, average rating, follower count, and monetization progress toward the thresholds (500 followers, 3.5★ average from 500+ ratings, watch-hours target).
- Short video posts with view counting, star ratings, and study-only content policy notice.
- Per-user creator settings page (visibility, comments, ratings, monetization opt-in).
- Admin **Creators** page: review applications, approve/revoke monetization, adjust thresholds, view analytics. KYC is required only after approval and is requested automatically then.
- Admin **Ads** page: create an ad (image, copy, link) and target it to specific users, segments, or everyone; ads render in-app for targeted users only.

## Batch 4 — Voice assistant + error sweep

- ElevenLabs voice assistant inside Guru.AI (speak questions, hear answers), enabled/disabled and voice-selected by admin.
- Sweep every admin page and user page for runtime errors and fix them.

## Technical notes

- New tables: `store_products`, `store_orders`, `prize_awards`, `ads`, `ad_targets`, `creator_profiles`, `post_views`, `post_ratings` — each with RLS, grants, and admin-only write policies.
- All admin writes continue to go through password-gated server functions (`requireAdminPassword`) with the service-role client, matching the existing admin pattern.
- ElevenLabs needs its connector linked so the API key is available server-side; I'll request that when Batch 4 starts.
- Existing routes are preserved with redirects where things move, so no links break.
