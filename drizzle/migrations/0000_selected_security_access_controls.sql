CREATE OR REPLACE FUNCTION public.has_current_premium_membership() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_memberships WHERE user_id = auth.uid() AND status = 'active' AND starts_at <= now() AND ends_at > now()); $$;
REVOKE ALL ON FUNCTION public.has_current_premium_membership() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_current_premium_membership() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.protect_profile_managed_fields() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$ BEGIN
IF current_user IN ('anon','authenticated') AND (NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance OR NEW.banned IS DISTINCT FROM OLD.banned OR NEW.phone_verified IS DISTINCT FROM OLD.phone_verified OR NEW.referral_code IS DISTINCT FROM OLD.referral_code OR NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN RAISE EXCEPTION 'Protected account fields cannot be changed'; END IF;
RETURN NEW; END; $$;
CREATE TRIGGER protect_profile_managed_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_managed_fields();

ALTER POLICY "Signed-in users read published resources" ON public.guru_resources USING (active AND status = 'published' AND (access_type IN ('free','signed_in') OR (access_type = 'premium' AND public.has_current_premium_membership())));
ALTER POLICY "guru_ai_sources_read_active" ON public.guru_ai_sources USING (active AND (resource_id IS NULL OR EXISTS (SELECT 1 FROM public.guru_resources r WHERE r.id = resource_id)));

ALTER POLICY "exams readable" ON public.guru_exams USING (active);
ALTER POLICY "college subjects readable" ON public.guru_college_subjects USING (active);
ALTER POLICY "guru_characters public read" ON public.guru_characters USING (active);
ALTER POLICY "guru_subjects read" ON public.guru_subjects USING (active);
ALTER POLICY "regulations readable" ON public.guru_college_regulations USING (active);
ALTER POLICY "exam topics readable" ON public.guru_exam_topics USING (active);
ALTER POLICY "cats public read" ON public.categories USING (active);
ALTER POLICY "guru_years read" ON public.guru_academic_years USING (active);
ALTER POLICY "guru_badges public read" ON public.guru_badges USING (active);
ALTER POLICY "contests public read" ON public.contests USING (active OR results_status = 'declared');
ALTER POLICY "guru_books read" ON public.guru_books USING (active AND status = 'published');
ALTER POLICY "college topics readable" ON public.guru_college_topics USING (active);
ALTER POLICY "guru_boards read" ON public.guru_boards USING (active);
ALTER POLICY "college units readable" ON public.guru_college_units USING (active);
ALTER POLICY "events public read" ON public.seasonal_events USING (active);
ALTER POLICY "guru_costumes public read" ON public.guru_character_costumes USING (active);
ALTER POLICY "guru_classes read" ON public.guru_classes USING (active);
ALTER POLICY "guru_chapters read" ON public.guru_chapters USING (active);
ALTER POLICY "guru_topics read" ON public.guru_topics USING (active);
ALTER POLICY "guru_lessons read" ON public.guru_lessons USING (active AND status = 'published');
ALTER POLICY "missions public read" ON public.missions USING (active);
ALTER POLICY "exam subjects readable" ON public.guru_exam_subjects USING (active);
ALTER POLICY "degrees readable" ON public.guru_college_degrees USING (active);
ALTER POLICY "Anyone can view premium features" ON public.premium_features USING (active);
ALTER POLICY "Anyone can view plan features" ON public.membership_features USING (EXISTS (SELECT 1 FROM public.memberships m WHERE m.id = membership_id AND m.active));

ALTER POLICY "q public read" ON public.questions TO authenticated USING (EXISTS (SELECT 1 FROM public.contests c JOIN public.contest_attempts a ON a.contest_id = c.id WHERE c.category_id = questions.category_id AND a.user_id = auth.uid() AND c.active AND c.results_status <> 'declared' AND (c.starts_at IS NULL OR c.starts_at <= now()) AND (c.ends_at IS NULL OR c.ends_at > now())));
REVOKE SELECT ON public.questions FROM anon, authenticated;
GRANT SELECT (id,category_id,question,options,difficulty,time_seconds,created_at) ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;

ALTER POLICY "settings public read" ON public.app_settings USING (key IN ('branding','banner','subscription_config','community_moderation','admin_upi_id','admin_upi_qr','min_deposit','max_deposit','min_withdrawal','max_withdrawal_per_day','new_user_bonus','correct_points','wrong_points','vip_enabled','maintenance_mode','maintenance_message','email_verification_required','kyc_required_for_withdraw','rewards'));

ALTER POLICY "books bucket read" ON storage.objects USING (bucket_id = 'books' AND EXISTS (SELECT 1 FROM public.books b WHERE b.file_path = storage.objects.name));
ALTER POLICY "community read" ON storage.objects USING (bucket_id = 'community' AND (owner_id = auth.uid()::text OR (storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.community_posts p WHERE p.media_url = storage.objects.name AND NOT p.hidden) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.avatar_url = storage.objects.name)));
