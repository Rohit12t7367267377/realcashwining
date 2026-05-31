
create policy "otp deny all to clients" on public.otp_codes
  for all to authenticated, anon
  using (false) with check (false);
