// Verifies 20261021000000_community_v2.sql on PGlite against stubs of the pre-existing community tables.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
await db.exec(`
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key, created_at timestamptz default now() - interval '30 days');
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid', true),'')::uuid $$;
  create role authenticated; create role service_role;
  create function public.has_role(_u uuid, _r text) returns boolean language sql as $$ select coalesce(current_setting('app.admin', true),'') = _u::text $$;
  create function public.touch_updated_at() returns trigger language plpgsql as $$ begin return new; end $$;
  create table public.app_settings (key text primary key, value jsonb);
  create table public.contests (id uuid primary key default gen_random_uuid());
  create table public.profiles (id uuid primary key references auth.users(id), username text, full_name text, avatar_url text, bio text, banned boolean default false);
  create table public.follows (follower_id uuid not null references auth.users(id), following_id uuid not null references auth.users(id), created_at timestamptz default now(), primary key (follower_id, following_id), check (follower_id <> following_id));
  create table public.community_posts (id uuid primary key default gen_random_uuid(), user_id uuid not null, body text not null default '', media_url text,
    media_type text check (media_type in ('image','video')), hidden boolean not null default false, like_count int not null default 0, comment_count int not null default 0,
    created_at timestamptz default now(), updated_at timestamptz default now());
  create table public.post_likes (post_id uuid not null references public.community_posts(id) on delete cascade, user_id uuid not null, created_at timestamptz default now(), primary key (post_id, user_id));
  create table public.post_comments (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.community_posts(id) on delete cascade, user_id uuid not null, body text not null, hidden boolean default false, created_at timestamptz default now());
  create table public.post_views (id uuid primary key default gen_random_uuid(), post_id uuid not null references public.community_posts(id) on delete cascade, user_id uuid references auth.users(id), watch_seconds int not null default 0, created_at timestamptz default now());
  create table public.direct_messages (id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id), recipient_id uuid not null references auth.users(id), body text not null, read_at timestamptz, created_at timestamptz default now());
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(n text) returns text[] language sql as $$ select string_to_array(n,'/') $$;
  alter table public.community_posts enable row level security; alter table public.post_likes enable row level security;
  alter table public.post_comments enable row level security; alter table public.follows enable row level security;
  alter table public.direct_messages enable row level security; alter table storage.objects enable row level security;
  create policy "posts visible" on public.community_posts for select to authenticated using (true);
  create policy "posts update own or admin" on public.community_posts for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
  create policy "posts insert own" on public.community_posts for insert to authenticated with check (user_id = auth.uid());
  create policy "likes visible" on public.post_likes for select to authenticated using (true);
  create policy "comments visible" on public.post_comments for select to authenticated using (true);
  create policy "Anyone read follows" on public.follows for select to authenticated using (true);
  create policy "Follow yourself only" on public.follows for insert to authenticated with check (follower_id = auth.uid());
  create policy "Unfollow yourself only" on public.follows for delete to authenticated using (follower_id = auth.uid());
  create policy "Participants read their messages" on public.direct_messages for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);
  create policy "Mutual followers can send messages" on public.direct_messages for insert to authenticated with check (auth.uid() = sender_id);
  create policy "Recipient can mark messages read" on public.direct_messages for update to authenticated using (auth.uid() = recipient_id);
  create policy "community read" on storage.objects for select to authenticated using (bucket_id = 'community');
  grant usage on schema public, auth, storage to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on storage.objects to authenticated;
  grant execute on function auth.uid(), public.has_role(uuid,text), storage.foldername(text) to authenticated;
`);
const sql = readFileSync("supabase/migrations/20261021000000_community_v2.sql", "utf8");
await db.exec(sql); await db.exec(sql); // must be re-runnable
const U = (n) => `00000000-0000-0000-0000-00000000000${n}`;
const [A, B, C, ADMIN] = [U(1), U(2), U(3), U(9)];
for (const id of [A, B, C, ADMIN]) await db.exec(`insert into auth.users (id) values ('${id}'); insert into public.profiles (id, username) values ('${id}','u${id.slice(-1)}');`);
await db.exec(`insert into public.profiles (id) select gen_random_uuid() where false;`);
const as = async (id, admin = false) => { await db.exec(`reset role; set app.uid='${id}'; set app.admin='${admin ? id : ""}'; set role authenticated;`); };
const root = async () => { await db.exec(`reset role; set app.uid=''; set app.admin='';`); };
const fails = async (s) => { try { await db.exec(s); return false; } catch { return true; } };
const rows = async (s) => (await db.query(s)).rows;
const out = []; const t = (n, ok) => out.push([n, !!ok]);

// --- follows & privacy
await root(); await db.exec(`insert into public.community_profile_settings (user_id, is_private) values ('${B}', true)`);
await as(A);
await db.exec(`insert into public.follows (follower_id, following_id, status) values ('${A}','${B}','accepted')`); // client tries to self-accept
t("follow of a private account is forced to pending", (await rows(`select status from public.follows where follower_id='${A}' and following_id='${B}'`))[0].status === "pending");
t("cannot self-accept by update", await fails(`update public.follows set status='accepted' where follower_id='${A}'`) || (await rows(`select status from public.follows where follower_id='${A}'`))[0].status === "pending");
t("duplicate follow rejected", await fails(`insert into public.follows (follower_id, following_id) values ('${A}','${B}')`));
t("self follow rejected", await fails(`insert into public.follows (follower_id, following_id) values ('${A}','${A}')`));
await as(C);
t("other user cannot accept a request", (await db.query(`update public.follows set status='accepted' where follower_id='${A}' and following_id='${B}' returning 1`)).rows.length === 0);
await as(B);
await db.exec(`update public.follows set status='accepted' where follower_id='${A}' and following_id='${B}'`);
t("owner accepts a request", (await rows(`select status from public.follows where follower_id='${A}'`))[0].status === "accepted");
t("owner cannot edit follower_id", await fails(`update public.follows set follower_id='${C}'`));

// --- posts visibility (private author B, public author A)
await root(); await db.exec(`insert into public.community_posts (id, user_id, body) values ('10000000-0000-0000-0000-000000000001','${B}','private post'), ('10000000-0000-0000-0000-000000000002','${A}','public post')`);
await as(C);
const seenC = (await rows(`select id from public.community_posts`)).map((r) => r.id);
t("non-follower cannot see private account posts", !seenC.includes("10000000-0000-0000-0000-000000000001") && seenC.includes("10000000-0000-0000-0000-000000000002"));
await as(A);
t("accepted follower sees private posts", (await rows(`select id from public.community_posts`)).length === 2);
t("direct post insert is blocked (must use server function)", await fails(`insert into public.community_posts (user_id, body) values ('${A}','x')`));
t("owner cannot unhide/alter own post via update", await fails(`update public.community_posts set body='x' where user_id='${A}'`));
await root(); await db.exec(`update public.community_posts set hidden = true where id='10000000-0000-0000-0000-000000000002'`);
await as(A); await db.exec(`update public.community_posts set hidden = false where id='10000000-0000-0000-0000-000000000002'`);
await root(); t("author cannot self-unhide an admin-hidden post", (await rows(`select hidden from public.community_posts where id='10000000-0000-0000-0000-000000000002'`))[0].hidden === true);
await db.exec(`update public.community_posts set hidden = false where id='10000000-0000-0000-0000-000000000002'`);
await as(ADMIN, true); await db.exec(`update public.community_posts set hidden = true where id='10000000-0000-0000-0000-000000000002'`);
await root(); t("admin can hide a post", (await rows(`select hidden from public.community_posts where id='10000000-0000-0000-0000-000000000002'`))[0].hidden === true);
t("hiding notified the author", (await rows(`select 1 from public.community_notifications where kind='moderation'`)).length === 1);
await db.exec(`update public.community_posts set hidden = false where id='10000000-0000-0000-0000-000000000002'`);

// --- likes obey visibility; counts; notifications dedupe
await as(C);
t("cannot like a post you cannot see", await fails(`insert into public.post_likes (post_id, user_id) values ('10000000-0000-0000-0000-000000000001','${C}')`));
await db.exec(`insert into public.post_likes (post_id, user_id) values ('10000000-0000-0000-0000-000000000002','${C}')`);
await root();
t("like count synced / notification created once", (await rows(`select count(*)::int n from public.community_notifications where kind='like' and user_id='${A}'`))[0].n === 1);

// --- blocks
await as(A); await db.exec(`insert into public.user_blocks (blocker_id, blocked_id) values ('${A}','${C}')`);
await root(); t("blocking removes follows both ways", (await rows(`select 1 from public.follows where (follower_id='${A}' and following_id='${C}') or (follower_id='${C}' and following_id='${A}')`)).length === 0);
await as(C);
t("blocked user cannot see blocker's posts", (await rows(`select 1 from public.community_posts where user_id='${A}'`)).length === 0);
t("blocked user cannot follow blocker", await fails(`insert into public.follows (follower_id, following_id) values ('${C}','${A}')`));
t("blocked user cannot see that they are blocked", (await rows(`select 1 from public.user_blocks`)).length === 0);

// --- messaging rule
await root(); await db.exec(`delete from public.user_blocks; delete from public.follows;`);
await as(A); await db.exec(`insert into public.follows (follower_id, following_id) values ('${A}','${C}')`);
t("one-way follow cannot message", await fails(`insert into public.direct_messages (sender_id, recipient_id, body) values ('${A}','${C}','hi')`));
await as(C); await db.exec(`insert into public.follows (follower_id, following_id) values ('${C}','${A}')`);
await db.exec(`insert into public.direct_messages (sender_id, recipient_id, body) values ('${C}','${A}','hi')`);
t("mutual follow can message", true);
t("cannot spoof sender", await fails(`insert into public.direct_messages (sender_id, recipient_id, body) values ('${A}','${C}','spoof')`));
t("empty / oversize message rejected", await fails(`insert into public.direct_messages (sender_id, recipient_id, body) values ('${C}','${A}','')`) && await fails(`insert into public.direct_messages (sender_id, recipient_id, body) values ('${C}','${A}','${"x".repeat(2001)}')`));
await root(); await db.exec(`insert into public.user_blocks (blocker_id, blocked_id) values ('${A}','${C}')`); // also unfollows
await as(C);
t("blocked pair cannot message", await fails(`insert into public.direct_messages (sender_id, recipient_id, body) values ('${C}','${A}','still?')`));
await root(); await db.exec(`delete from public.user_blocks; insert into public.follows (follower_id, following_id) values ('${A}','${C}'), ('${C}','${A}') on conflict do nothing;`);
await as(C);
let limited = false; try { for (let i = 0; i < 25; i++) await db.exec(`insert into public.direct_messages (sender_id, recipient_id, body) values ('${C}','${A}','m${i}')`); } catch { limited = true; }
t("DM rate limit kicks in", limited);
await as(B);
t("third party cannot read messages", (await rows(`select 1 from public.direct_messages`)).length === 0);
await as(A);
t("recipient can mark read but not edit body", (await db.query(`update public.direct_messages set read_at = now() returning 1`)).rows.length > 0 && await fails(`update public.direct_messages set body='edited'`));

// --- watch time
await root(); await db.exec(`update public.community_posts set duration_seconds = 60 where id='10000000-0000-0000-0000-000000000002'`);
await as(C);
const w1 = (await rows(`select public.record_post_watch('10000000-0000-0000-0000-000000000002', 9999) as s`))[0].s;
t("watch seconds are capped by real elapsed time", w1 <= 6);
await db.exec(`select pg_sleep(0.1)`);
const w2 = (await rows(`select public.record_post_watch('10000000-0000-0000-0000-000000000002', 3) as s`))[0].s;
t("watch time never decreases and repeats do not add rows", w2 >= w1 && (await rows(`select 1 from public.post_views where user_id='${C}'`)).length === 1);
t("raw view inserts are blocked", await fails(`insert into public.post_views (post_id, user_id, watch_seconds) values ('10000000-0000-0000-0000-000000000002','${C}',999)`));
await as(A);
t("own views are not counted", (await rows(`select public.record_post_watch('10000000-0000-0000-0000-000000000002', 30) as s`))[0].s === 0);
t("creator analytics only for self", await fails(`select * from public.creator_analytics('${C}', 7)`) && (await rows(`select * from public.creator_analytics('${A}', 7)`)).length === 7);

// --- creator ratings
await root(); await db.exec(`insert into public.follows (follower_id, following_id) values ('${C}','${A}') on conflict do nothing`);
await as(C);
await db.exec(`select public.rate_creator('${A}', 5, 'great teaching')`);
await db.exec(`select public.rate_creator('${A}', 4, 'updated')`);
t("one rating per rater (update, not duplicate)", (await rows(`select count(*)::int n, max(stars) m from public.creator_ratings`))[0].n === 1);
t("self-rating rejected", await fails(`select public.rate_creator('${C}', 5)`));
t("invalid stars rejected", await fails(`select public.rate_creator('${A}', 6)`));
t("non-follower cannot rate", await (async () => { await as(B); return fails(`select public.rate_creator('${A}', 5)`); })());
t("direct rating write blocked", await (async () => { await as(C); return fails(`insert into public.creator_ratings (creator_id, rater_id, stars) values ('${A}','${C}',5)`); })());
const sum = (await rows(`select * from public.creator_rating_summary('${A}')`))[0];
t("rating average is accurate", Number(sum.avg_stars) === 4 && sum.ratings === 1 && sum.s4 === 1);
const ms = (await rows(`select * from public.creator_milestone('${A}')`))[0];
t("milestone not eligible with 1 rating / few followers", ms.eligible === false && ms.need_followers === 500);

// --- reports & saves & notifications privacy
await as(C);
await db.exec(`insert into public.content_reports (reporter_id, target_type, target_id, reason) values ('${C}','post','10000000-0000-0000-0000-000000000002','spam')`);
t("duplicate report rejected", await fails(`insert into public.content_reports (reporter_id, target_type, target_id, reason) values ('${C}','post','10000000-0000-0000-0000-000000000002','abuse')`));
t("cannot self-resolve a report", await fails(`insert into public.content_reports (reporter_id, target_type, target_id, reason, status) values ('${C}','account','${B}','abuse','actioned')`));
t("cannot report a message you are not part of", await (async () => { await root(); const m = (await rows(`select id from public.direct_messages limit 1`))[0].id; await as(B); return fails(`insert into public.content_reports (reporter_id, target_type, target_id, reason) values ('${B}','message','${m}','abuse')`); })());
await as(C); await db.exec(`insert into public.post_saves (user_id, post_id) values ('${C}','10000000-0000-0000-0000-000000000002')`);
await as(A); t("saves are private", (await rows(`select 1 from public.post_saves`)).length === 0);
t("notifications are private", (await rows(`select 1 from public.community_notifications where user_id <> '${A}'`)).length === 0);

// --- storage visibility
await root(); await db.exec(`insert into storage.objects (bucket_id, name) values ('community','${A}/pic.png'), ('community','${B}/secret.png')`);
await db.exec(`update public.community_posts set media_url='${A}/pic.png' where id='10000000-0000-0000-0000-000000000002'`);
await as(C);
t("media of a visible post is readable, random objects are not", (await rows(`select name from storage.objects`)).length === 1);

let failed = 0; for (const [n, ok] of out) { console.log(ok ? "PASS" : "FAIL", n); if (!ok) failed++; }
console.log(`${out.length - failed}/${out.length} passed`);
process.exit(failed ? 1 : 0);
