CREATE OR REPLACE FUNCTION public.admin_manage_user_role(
  _actor_id uuid,
  _user_id uuid,
  _role_id uuid,
  _enabled boolean,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.admin_role_definitions%ROWTYPE;
  v_actor_is_super boolean;
  v_exists boolean;
  v_super_count integer;
BEGIN
  IF NOT public.admin_has_permission(_actor_id, 'roles.manage') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _actor_id = _user_id THEN RAISE EXCEPTION 'Administrators cannot change their own role assignments'; END IF;
  IF length(trim(coalesce(_reason, ''))) < 3 THEN RAISE EXCEPTION 'Reason required'; END IF;

  SELECT * INTO v_role FROM public.admin_role_definitions WHERE id = _role_id AND active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active role not found'; END IF;

  SELECT count(*) INTO v_super_count
  FROM public.admin_user_role_assignments a
  JOIN public.admin_role_definitions r ON r.id = a.role_id
  WHERE r.name = 'super_admin' AND r.active = true;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_user_role_assignments a
    JOIN public.admin_role_definitions r ON r.id = a.role_id
    WHERE a.user_id = _actor_id AND r.name = 'super_admin' AND r.active = true
  ) INTO v_actor_is_super;

  IF v_role.name = 'super_admin' AND NOT v_actor_is_super AND v_super_count > 0 THEN
    RAISE EXCEPTION 'Only a Super Admin can manage Super Admin assignments';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.admin_user_role_assignments WHERE user_id = _user_id AND role_id = _role_id) INTO v_exists;
  IF _enabled AND NOT v_exists THEN
    INSERT INTO public.admin_user_role_assignments(user_id, role_id, assigned_by) VALUES (_user_id, _role_id, _actor_id);
  ELSIF NOT _enabled AND v_exists THEN
    IF v_role.name = 'super_admin' AND v_super_count <= 1 THEN RAISE EXCEPTION 'The final Super Admin cannot be removed'; END IF;
    DELETE FROM public.admin_user_role_assignments WHERE user_id = _user_id AND role_id = _role_id;
  END IF;

  PERFORM public.write_admin_audit(
    _actor_id, 'roles.manage', CASE WHEN _enabled THEN 'role.assign' ELSE 'role.revoke' END,
    'admin_user_role_assignment', _user_id::text || ':' || _role_id::text, 'success', trim(_reason),
    jsonb_build_object('assigned', v_exists, 'role', v_role.name),
    jsonb_build_object('assigned', _enabled, 'role', v_role.name),
    jsonb_build_object('target_user_id', _user_id, 'role_id', _role_id, 'bootstrap', v_role.name = 'super_admin' AND v_super_count = 0)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_manage_user_role(uuid,uuid,uuid,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_user_role(uuid,uuid,uuid,boolean,text) TO service_role;