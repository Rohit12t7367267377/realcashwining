
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, app_role) from public, anon;
-- keep authenticated execute for has_role since RLS policies call it as the user
