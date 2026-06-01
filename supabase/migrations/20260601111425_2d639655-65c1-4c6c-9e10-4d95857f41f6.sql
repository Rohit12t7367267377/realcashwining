
-- Seed new settings (idempotent)
INSERT INTO public.app_settings (key, value, updated_at) VALUES
  ('admin_upi_id', to_jsonb('admin@upi'::text), now()),
  ('new_user_bonus', to_jsonb(0), now()),
  ('prize_pool_pct', to_jsonb(50), now()),
  ('prize_pool_total', to_jsonb(0), now())
ON CONFLICT (key) DO NOTHING;

-- Update new-user handler to apply configurable starting balance
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  is_first boolean;
  bonus numeric := 0;
begin
  select coalesce((value)::text::numeric, 0) into bonus from public.app_settings where key = 'new_user_bonus';
  insert into public.profiles (id, full_name, phone, referral_code, wallet_balance)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    'CWL' || upper(substr(md5(new.id::text), 1, 6)),
    coalesce(bonus, 0)
  );
  if coalesce(bonus, 0) > 0 then
    insert into public.transactions (user_id, type, amount, note)
    values (new.id, 'credit', bonus, 'Welcome bonus');
  end if;
  select not exists (select 1 from public.user_roles where role = 'admin') into is_first;
  insert into public.user_roles (user_id, role) values (new.id, case when is_first then 'admin'::app_role else 'user'::app_role end);
  return new;
end;
$function$;
