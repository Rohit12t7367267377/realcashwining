
REVOKE EXECUTE ON FUNCTION public.admin_declare_contest_result(uuid, uuid, integer, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_declare_contest_result(uuid, uuid, integer, numeric) TO service_role;
