## Scope

Six items in one pass.

### 1. Fix "SSC / UPSC click does nothing" on home

The category links on the home page use `<Link to="/category/$id" params={{ id: c.id }}>`. The route file exists. Most likely cause: the home page on the logged-in landing was actually the **logged-out** Landing component (which only shows category *cards*, not links). I'll wrap those tiles in `<Link>` too so they navigate.

### 2. Forgot Password

- Add "Forgot password?" link on `/auth` login form → opens a small dialog → calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + "/reset-password" })`.
- Create `/reset-password` route (public) → reads recovery token from URL → form to set new password → `supabase.auth.updateUser({ password })`.

### 3. Sports Live Quiz (cricket / football)

Per your choice: admin creates a "live match" contest with pre-added questions; users join during the match window.

- Add two new categories to the **DB** `categories` table: Cricket 🏏, Football ⚽ (so the existing admin Contests + Questions tooling works as-is — admin can add questions & contests under these categories).
- Add a **Sports** section on the home page that lists active contests in those two categories with a "🔴 LIVE" badge when `starts_at <= now <= ends_at`.
- No new schema — reuses your `contests` + `questions` tables and existing admin UI.

### 4. Terms & Conditions

Static `/terms` route with standard quiz/contest T&C content. Link from bottom of home + auth pages.

### 5. Help & Support

Static `/support` route with FAQ + "Email us" mailto button → `my5270970@gmail.com`. Link from profile page.

### 6. PDF Books library

- Create storage bucket `books` (public read).
- New table `books` (title, description, category, file_path, uploaded_by, downloads).
- Admin-only upload via new admin page `/admin/books`.
- Public `/books` route: searchable grid of all books with category filter + download button. Increments download counter.

## Technical Notes

- DB migration: add 2 sports categories + create `books` table with RLS (public read, admin write via `has_role`).
- Storage: create `books` bucket (public).
- Routes added: `/reset-password`, `/terms`, `/support`, `/books`, `/admin/books`.
- Routes edited: `/auth` (forgot password link), `/` (sports section, footer links, fixed landing category links), `/admin` sidebar (Books link), `/profile` (support link).

## Out of scope (ask if you want them)

- Real-time "push next question now" admin control during a live match (you chose the simpler join-during-window flow).
- PDF preview in browser (just download links).
