
-- Roles
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  referral_code text unique,
  wallet_balance numeric not null default 0,
  banned boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Profile + first-admin trigger on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  insert into public.profiles (id, full_name, phone, referral_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'CWL' || upper(substr(md5(new.id::text), 1, 6))
  );
  select not exists (select 1 from public.user_roles where role = 'admin') into is_first;
  insert into public.user_roles (user_id, role) values (new.id, case when is_first then 'admin'::app_role else 'user'::app_role end);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles RLS
create policy "profiles self read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles admin read" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "profiles self update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles admin update" on public.profiles for update to authenticated using (public.has_role(auth.uid(), 'admin'));

-- user_roles RLS
create policy "roles self read" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "roles admin read" on public.user_roles for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "cats public read" on public.categories for select to anon, authenticated using (true);
create policy "cats admin write" on public.categories for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Questions
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  question text not null,
  options jsonb not null,
  correct_index int not null,
  explanation text,
  difficulty text default 'medium',
  created_at timestamptz not null default now()
);
grant select on public.questions to anon, authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
create policy "q public read" on public.questions for select to anon, authenticated using (true);
create policy "q admin write" on public.questions for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Contests
create table public.contests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id uuid references public.categories(id) on delete set null,
  entry_fee numeric not null default 0,
  prize_pool numeric not null default 0,
  first_prize numeric not null default 0,
  duration_minutes int not null default 10,
  num_questions int not null default 10,
  contest_type text not null default 'paid',
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.contests to anon, authenticated;
grant all on public.contests to service_role;
alter table public.contests enable row level security;
create policy "contests public read" on public.contests for select to anon, authenticated using (true);
create policy "contests admin write" on public.contests for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "txn self read" on public.transactions for select to authenticated using (user_id = auth.uid());
create policy "txn admin read" on public.transactions for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "txn admin write" on public.transactions for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Settings (key/value)
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "settings public read" on public.app_settings for select to anon, authenticated using (true);
create policy "settings admin write" on public.app_settings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.app_settings (key, value) values
  ('rewards', '{"dailyMin":5,"dailyMax":20,"referralBonus":25,"signupBonus":50}'::jsonb),
  ('branding', '{"siteName":"Cash Winning League","tagline":"Play. Win. Repeat."}'::jsonb),
  ('banner', '{"message":"🎉 Welcome! Get ₹50 signup bonus","active":true}'::jsonb);
