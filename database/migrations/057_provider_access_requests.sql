BEGIN;
ALTER TABLE public.provider_requests
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS contact_number text,
  ADD COLUMN IF NOT EXISTS business_registration_number text,
  ADD COLUMN IF NOT EXISTS proof_of_ownership_url text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by bigint REFERENCES public.users(user_id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS service_provider_id bigint REFERENCES public.service_providers(service_provider_id);

-- Requests contain personal information. Access goes through the authenticated API.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'provider_requests'
  LOOP EXECUTE format('DROP POLICY %I ON public.provider_requests', p.policyname); END LOOP;
END $$;
ALTER TABLE public.provider_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_requests FROM anon, authenticated;
GRANT ALL ON public.provider_requests TO service_role;

-- Lock the request so concurrent reviews cannot create multiple providers.
CREATE OR REPLACE FUNCTION public.review_provider_request(p_request_id bigint, p_status text, p_reason text, p_reviewer bigint)
RETURNS public.provider_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.provider_requests; provider_id bigint; applicant_email text;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') OR length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'Invalid review' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO r FROM public.provider_requests WHERE request_id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE = 'P0002'; END IF;
  IF r.status <> 'pending' THEN
    IF r.status = p_status AND r.reason = p_reason THEN RETURN r; END IF;
    RAISE EXCEPTION 'Request has already been reviewed' USING ERRCODE = '22023';
  END IF;
  IF p_status = 'approved' THEN
    IF r.user_id IS NULL THEN RAISE EXCEPTION 'Applicant no longer exists' USING ERRCODE = '22023'; END IF;
    SELECT email INTO applicant_email FROM public.users WHERE user_id = r.user_id;
    INSERT INTO public.service_providers(name, phone, email, user_id, is_verified)
    VALUES (coalesce(r.business_name, (SELECT name FROM public.pet_friendly_places WHERE pet_friendly_place_id = r.place_id)), r.contact_number, applicant_email, r.user_id, true)
    RETURNING service_provider_id INTO provider_id;
  END IF;
  UPDATE public.provider_requests SET status = p_status, reason = p_reason,
    reviewed_by = p_reviewer, reviewed_at = now(), updated_at = now(), service_provider_id = provider_id
  WHERE request_id = p_request_id RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.review_provider_request(bigint, text, text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_provider_request(bigint, text, text, bigint) TO service_role;
COMMIT;

