
-- OTP codes (hashed)
create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,          -- phone in E.164 form
  purpose text not null,             -- 'signup' | 'login' | 'withdrawal' | 'wallet'
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts int not null default 0,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index otp_codes_lookup on public.otp_codes(identifier, purpose, consumed_at);
grant select, insert, update, delete on public.otp_codes to authenticated;
grant all on public.otp_codes to service_role;
alter table public.otp_codes enable row level security;
-- only service role writes/reads via server fns. No client policies.

-- Deposit requests (manual UPI flow)
create table public.deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric not null check (amount > 0),
  upi_utr text not null,                  -- the 12-digit UTR/reference from UPI
  payer_upi text,                         -- optional payer UPI id
  screenshot_url text,
  status text not null default 'pending', -- pending | approved | rejected
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index deposit_requests_status on public.deposit_requests(status, created_at desc);
create index deposit_requests_user on public.deposit_requests(user_id, created_at desc);
grant select, insert on public.deposit_requests to authenticated;
grant all on public.deposit_requests to service_role;
alter table public.deposit_requests enable row level security;

create policy "deposit self read" on public.deposit_requests
  for select to authenticated using (user_id = auth.uid());
create policy "deposit self insert" on public.deposit_requests
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "deposit admin read" on public.deposit_requests
  for select to authenticated using (has_role(auth.uid(), 'admin'));
create policy "deposit admin write" on public.deposit_requests
  for update to authenticated using (has_role(auth.uid(), 'admin'));

-- Withdrawal requests
create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric not null check (amount > 0),
  upi_id text not null,
  status text not null default 'pending', -- pending | approved | rejected | paid
  admin_note text,
  payout_ref text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index withdrawal_requests_status on public.withdrawal_requests(status, created_at desc);
create index withdrawal_requests_user on public.withdrawal_requests(user_id, created_at desc);
grant select on public.withdrawal_requests to authenticated;
grant all on public.withdrawal_requests to service_role;
alter table public.withdrawal_requests enable row level security;

create policy "withdraw self read" on public.withdrawal_requests
  for select to authenticated using (user_id = auth.uid());
create policy "withdraw admin read" on public.withdrawal_requests
  for select to authenticated using (has_role(auth.uid(), 'admin'));
create policy "withdraw admin write" on public.withdrawal_requests
  for update to authenticated using (has_role(auth.uid(), 'admin'));
-- inserts only happen via server fn (after OTP verify), so no insert policy.

-- Phone column on profiles already exists; add verified flag
alter table public.profiles add column if not exists phone_verified boolean not null default false;

-- Seed admin UPI in app_settings if not present
insert into public.app_settings(key, value) values
  ('admin_upi_id', '"admin@upi"'::jsonb),
  ('min_deposit', '10'::jsonb),
  ('min_withdrawal', '100'::jsonb),
  ('max_withdrawal_per_day', '5000'::jsonb)
on conflict (key) do nothing;
