CREATE TABLE public.admin_permissions (
  key text PRIMARY KEY,
  module text NOT NULL,
  label text NOT NULL,
  description text,
  dangerous boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators view permissions" ON public.admin_permissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.admin_role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  system boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_role_definitions TO authenticated;
GRANT ALL ON public.admin_role_definitions TO service_role;
ALTER TABLE public.admin_role_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators view role definitions" ON public.admin_role_definitions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.admin_role_permissions (
  role_id uuid NOT NULL REFERENCES public.admin_role_definitions(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);
GRANT SELECT ON public.admin_role_permissions TO authenticated;
GRANT ALL ON public.admin_role_permissions TO service_role;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators view role permissions" ON public.admin_role_permissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.admin_user_role_assignments (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.admin_role_definitions(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
GRANT SELECT ON public.admin_user_role_assignments TO authenticated;
GRANT ALL ON public.admin_user_role_assignments TO service_role;
ALTER TABLE public.admin_user_role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators view role assignments" ON public.admin_user_role_assignments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_roles text[] NOT NULL DEFAULT '{}',
  permission_key text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  result text NOT NULL CHECK (result IN ('success','denied','failed')),
  reason text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}',
  request_id text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT INSERT, SELECT ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Administrators view audit logs" ON public.admin_audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX admin_audit_logs_actor_created_idx ON public.admin_audit_logs(actor_id, created_at DESC);
CREATE INDEX admin_audit_logs_target_created_idx ON public.admin_audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX admin_audit_logs_action_created_idx ON public.admin_audit_logs(action, created_at DESC);

CREATE TABLE public.admin_rate_limits (
  scope text NOT NULL,
  actor_id uuid NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  PRIMARY KEY (scope, actor_id, window_start)
);
GRANT ALL ON public.admin_rate_limits TO service_role;
ALTER TABLE public.admin_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER admin_role_definitions_touch BEFORE UPDATE ON public.admin_role_definitions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.admin_permissions(key,module,label,description,dangerous) VALUES
('dashboard.view','dashboard','View dashboard','View operational metrics',false),
('users.view','users','View users','View user accounts and activity',false),
('users.edit','users','Edit users','Edit permitted profile fields',false),
('users.suspend','users','Suspend users','Suspend or restore accounts',true),
('users.ban','users','Ban users','Ban or unban accounts',true),
('roles.manage','security','Manage roles','Create roles and assign permissions',true),
('quizzes.manage','quizzes','Manage quizzes','Create and manage quizzes and questions',false),
('content.manage','content','Manage content','Manage home and learning content',false),
('rewards.manage','rewards','Manage rewards','Manage XP, coins, missions and rewards',true),
('leaderboards.manage','rewards','Manage leaderboards','Manage ranking rules and results',true),
('ai.manage','ai','Manage AI','Manage AI models, prompts and teachers',true),
('community.moderate','community','Moderate community','Moderate posts, comments and reports',true),
('finance.view','finance','View finance','View payments, wallets and subscriptions',false),
('finance.adjust','finance','Adjust balances','Adjust wallet, payout and refund state',true),
('subscriptions.manage','elite','Manage subscriptions','Manage plans, subscriptions and entitlements',true),
('notifications.manage','notifications','Manage notifications','Create and send notifications',true),
('analytics.view','analytics','View analytics','View platform analytics',false),
('storage.manage','storage','Manage storage','Manage protected platform files',true),
('integrations.manage','integrations','Manage integrations','Manage integration configuration',true),
('security.view','security','View security','View security and anti-abuse events',false),
('audit_logs.view','security','View audit logs','View immutable administrator activity',false),
('settings.manage','settings','Manage settings','Change platform configuration',true)
ON CONFLICT (key) DO UPDATE SET module=EXCLUDED.module,label=EXCLUDED.label,description=EXCLUDED.description,dangerous=EXCLUDED.dangerous;

INSERT INTO public.admin_role_definitions(name,label,description,system) VALUES
('super_admin','Super Admin','Full platform control',true),
('admin','Admin','Broad operational control',true),
('moderator','Moderator','Community and user safety moderation',true),
('quiz_manager','Quiz Manager','Quiz, question and contest management',true),
('content_manager','Content Manager','Home, library and learning content',true),
('rewards_manager','Rewards Manager','Rewards, XP and leaderboard operations',true),
('ai_manager','AI Manager','Guru.AI configuration and content',true),
('finance_manager','Finance Manager','Payments, wallets and subscriptions',true),
('support_manager','Support Manager','User support and account review',true),
('analyst','Analyst','Read-only dashboard and analytics',true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.admin_role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.admin_role_definitions r CROSS JOIN public.admin_permissions p WHERE r.name IN ('super_admin','admin')
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.admin_role_definitions r JOIN public.admin_permissions p ON p.key IN ('users.view','users.suspend','community.moderate','security.view') WHERE r.name='moderator'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.admin_role_definitions r JOIN public.admin_permissions p ON p.key IN ('dashboard.view','quizzes.manage','leaderboards.manage') WHERE r.name='quiz_manager'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.admin_role_definitions r JOIN public.admin_permissions p ON p.key IN ('dashboard.view','content.manage','storage.manage') WHERE r.name='content_manager'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.admin_role_definitions r JOIN public.admin_permissions p ON p.key IN ('dashboard.view','rewards.manage','leaderboards.manage') WHERE r.name='rewards_manager'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.admin_role_definitions r JOIN public.admin_permissions p ON p.key IN ('dashboard.view','ai.manage','analytics.view') WHERE r.name='ai_manager'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.admin_role_definitions r JOIN public.admin_permissions p ON p.key IN ('dashboard.view','finance.view','finance.adjust','subscriptions.manage') WHERE r.name='finance_manager'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.admin_role_definitions r JOIN public.admin_permissions p ON p.key IN ('dashboard.view','users.view','users.edit') WHERE r.name='support_manager'
ON CONFLICT DO NOTHING;
INSERT INTO public.admin_role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.admin_role_definitions r JOIN public.admin_permissions p ON p.key IN ('dashboard.view','analytics.view') WHERE r.name='analyst'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(_user_id,'admin') OR EXISTS (
    SELECT 1 FROM public.admin_user_role_assignments a
    JOIN public.admin_role_definitions r ON r.id=a.role_id AND r.active
    JOIN public.admin_role_permissions rp ON rp.role_id=r.id
    WHERE a.user_id=_user_id AND rp.permission_key=_permission
  )
$$;
REVOKE ALL ON FUNCTION public.admin_has_permission(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_has_permission(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consume_admin_rate_limit(_actor_id uuid,_scope text,_limit integer,_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_window timestamptz; v_count integer;
BEGIN
  IF NOT public.has_role(_actor_id,'admin') AND NOT EXISTS (SELECT 1 FROM public.admin_user_role_assignments WHERE user_id=_actor_id) THEN RETURN false; END IF;
  v_window := to_timestamp(floor(extract(epoch from now())/_window_seconds)*_window_seconds);
  INSERT INTO public.admin_rate_limits(scope,actor_id,window_start,request_count) VALUES(_scope,_actor_id,v_window,1)
  ON CONFLICT(scope,actor_id,window_start) DO UPDATE SET request_count=public.admin_rate_limits.request_count+1
  RETURNING request_count INTO v_count;
  RETURN v_count <= _limit;
END $$;
REVOKE ALL ON FUNCTION public.consume_admin_rate_limit(uuid,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_admin_rate_limit(uuid,text,integer,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.write_admin_audit(_actor_id uuid,_permission text,_action text,_target_type text,_target_id text,_result text,_reason text,_before jsonb,_after jsonb,_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_roles text[];
BEGIN
  IF NOT public.admin_has_permission(_actor_id,_permission) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT coalesce(array_agg(role_name),'{}') INTO v_roles FROM (
    SELECT role::text role_name FROM public.user_roles WHERE user_id=_actor_id
    UNION SELECT r.name FROM public.admin_user_role_assignments a JOIN public.admin_role_definitions r ON r.id=a.role_id WHERE a.user_id=_actor_id
  ) s;
  INSERT INTO public.admin_audit_logs(actor_id,actor_roles,permission_key,action,target_type,target_id,result,reason,before_data,after_data,metadata)
  VALUES(_actor_id,v_roles,_permission,_action,_target_type,_target_id,_result,_reason,_before,_after,coalesce(_metadata,'{}')) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.write_admin_audit(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_admin_audit(uuid,text,text,text,text,text,text,jsonb,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_adjust_wallet_atomic(_actor_id uuid,_user_id uuid,_amount numeric,_reason text,_idempotency_key text)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_before numeric; v_after numeric;
BEGIN
  IF NOT public.admin_has_permission(_actor_id,'finance.adjust') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _amount=0 OR abs(_amount)>100000 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  IF length(trim(_reason))<3 THEN RAISE EXCEPTION 'Reason required'; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_audit_logs WHERE metadata->>'idempotency_key'=_idempotency_key) THEN RAISE EXCEPTION 'Duplicate operation'; END IF;
  SELECT wallet_balance INTO v_before FROM public.profiles WHERE id=_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  v_after:=v_before+_amount;
  IF v_after<0 THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET wallet_balance=v_after WHERE id=_user_id;
  INSERT INTO public.transactions(user_id,type,amount,note) VALUES(_user_id,CASE WHEN _amount>0 THEN 'credit' ELSE 'debit' END,abs(_amount),'[admin] '||trim(_reason));
  PERFORM public.write_admin_audit(_actor_id,'finance.adjust','wallet.adjust','profile',_user_id::text,'success',_reason,jsonb_build_object('wallet_balance',v_before),jsonb_build_object('wallet_balance',v_after),jsonb_build_object('idempotency_key',_idempotency_key,'amount',_amount));
  RETURN v_after;
END $$;
REVOKE ALL ON FUNCTION public.admin_adjust_wallet_atomic(uuid,uuid,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet_atomic(uuid,uuid,numeric,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_review_deposit_atomic(_actor_id uuid,_request_id uuid,_action text,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; v_before numeric; v_after numeric; v_pct numeric; v_pool numeric;
BEGIN
  IF NOT public.admin_has_permission(_actor_id,'finance.adjust') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _action NOT IN ('approve','reject') OR length(trim(_reason))<3 THEN RAISE EXCEPTION 'Valid action and reason required'; END IF;
  SELECT * INTO r FROM public.deposit_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deposit not found'; END IF;
  IF r.status<>'pending' THEN RAISE EXCEPTION 'Deposit already reviewed'; END IF;
  IF _action='approve' THEN
    SELECT wallet_balance INTO v_before FROM public.profiles WHERE id=r.user_id FOR UPDATE;
    v_after:=v_before+r.amount;
    UPDATE public.profiles SET wallet_balance=v_after WHERE id=r.user_id;
    INSERT INTO public.transactions(user_id,type,amount,note) VALUES(r.user_id,'credit',r.amount,'Deposit approved (UTR '||r.upi_utr||')');
    SELECT coalesce((value)::text::numeric,50) INTO v_pct FROM public.app_settings WHERE key='prize_pool_pct';
    SELECT coalesce((value)::text::numeric,0) INTO v_pool FROM public.app_settings WHERE key='prize_pool_total' FOR UPDATE;
    INSERT INTO public.app_settings(key,value,updated_at) VALUES('prize_pool_total',to_jsonb(coalesce(v_pool,0)+(r.amount*coalesce(v_pct,50)/100)),now()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now();
  END IF;
  UPDATE public.deposit_requests SET status=CASE WHEN _action='approve' THEN 'approved' ELSE 'rejected' END,admin_note=_reason,reviewed_by=_actor_id,reviewed_at=now() WHERE id=_request_id;
  PERFORM public.write_admin_audit(_actor_id,'finance.adjust','deposit.'||_action,'deposit_request',_request_id::text,'success',_reason,jsonb_build_object('status','pending'),jsonb_build_object('status',CASE WHEN _action='approve' THEN 'approved' ELSE 'rejected' END),jsonb_build_object('amount',r.amount,'user_id',r.user_id));
END $$;
REVOKE ALL ON FUNCTION public.admin_review_deposit_atomic(uuid,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_deposit_atomic(uuid,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_withdrawal_atomic(_amount numeric,_upi_id text)
RETURNS TABLE(request_id uuid,new_balance numeric) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid:=auth.uid(); v_balance numeric; v_min numeric; v_max numeric; v_used numeric; v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id=v_user AND banned=false FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable'; END IF;
  SELECT coalesce((value)::text::numeric,100) INTO v_min FROM public.app_settings WHERE key='min_withdrawal';
  SELECT coalesce((value)::text::numeric,5000) INTO v_max FROM public.app_settings WHERE key='max_withdrawal_per_day';
  SELECT coalesce(sum(amount),0) INTO v_used FROM public.withdrawal_requests WHERE user_id=v_user AND created_at>=now()-interval '24 hours' AND status IN('pending','approved','paid');
  IF _amount<coalesce(v_min,100) THEN RAISE EXCEPTION 'Below minimum withdrawal'; END IF;
  IF v_used+_amount>coalesce(v_max,5000) THEN RAISE EXCEPTION 'Daily withdrawal limit exceeded'; END IF;
  IF v_balance<_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE public.profiles SET wallet_balance=wallet_balance-_amount WHERE id=v_user RETURNING wallet_balance INTO v_balance;
  INSERT INTO public.withdrawal_requests(user_id,amount,upi_id,status) VALUES(v_user,_amount,_upi_id,'pending') RETURNING id INTO v_id;
  INSERT INTO public.transactions(user_id,type,amount,note) VALUES(v_user,'debit',_amount,'Withdrawal requested → '||_upi_id);
  RETURN QUERY SELECT v_id,v_balance;
END $$;
REVOKE ALL ON FUNCTION public.submit_withdrawal_atomic(numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_withdrawal_atomic(numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_review_withdrawal_atomic(_actor_id uuid,_request_id uuid,_action text,_payout_ref text,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; v_before numeric; v_after numeric;
BEGIN
  IF NOT public.admin_has_permission(_actor_id,'finance.adjust') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _action NOT IN ('mark_paid','reject') OR length(trim(_reason))<3 THEN RAISE EXCEPTION 'Valid action and reason required'; END IF;
  SELECT * INTO r FROM public.withdrawal_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Withdrawal not found'; END IF;
  IF r.status NOT IN ('pending','approved') THEN RAISE EXCEPTION 'Withdrawal already reviewed'; END IF;
  IF _action='mark_paid' AND length(trim(coalesce(_payout_ref,'')))<3 THEN RAISE EXCEPTION 'Payout reference required'; END IF;
  IF _action='reject' THEN
    SELECT wallet_balance INTO v_before FROM public.profiles WHERE id=r.user_id FOR UPDATE;
    UPDATE public.profiles SET wallet_balance=wallet_balance+r.amount WHERE id=r.user_id RETURNING wallet_balance INTO v_after;
    INSERT INTO public.transactions(user_id,type,amount,note) VALUES(r.user_id,'credit',r.amount,'Withdrawal rejected — refund');
  END IF;
  UPDATE public.withdrawal_requests SET status=CASE WHEN _action='mark_paid' THEN 'paid' ELSE 'rejected' END,payout_ref=CASE WHEN _action='mark_paid' THEN _payout_ref ELSE NULL END,admin_note=_reason,reviewed_by=_actor_id,reviewed_at=now() WHERE id=_request_id;
  PERFORM public.write_admin_audit(_actor_id,'finance.adjust','withdrawal.'||_action,'withdrawal_request',_request_id::text,'success',_reason,jsonb_build_object('status',r.status),jsonb_build_object('status',CASE WHEN _action='mark_paid' THEN 'paid' ELSE 'rejected' END),jsonb_build_object('amount',r.amount,'user_id',r.user_id,'payout_ref',_payout_ref));
END $$;
REVOKE ALL ON FUNCTION public.admin_review_withdrawal_atomic(uuid,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_withdrawal_atomic(uuid,uuid,text,text,text) TO service_role;