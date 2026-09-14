BEGIN;

-- Public sign-up is enabled, so an already-verified Auth identity must be able
-- to receive the same minimum-access profile as a newly created identity.
-- Existing profiles, including inactive and elevated profiles, are untouched.
CREATE OR REPLACE FUNCTION public.complete_public_onboarding() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Verified identity required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.public_registrations(user_id)
  VALUES (auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.profiles(
    user_id,
    agent_id,
    display_name,
    role,
    clearance,
    clearance_level,
    active,
    public_account
  )
  SELECT
    id,
    'CR-' || id::text,
    left(
      coalesce(
        nullif(btrim(raw_user_meta_data->>'display_name'), ''),
        nullif(btrim(raw_user_meta_data->>'full_name'), ''),
        nullif(btrim(raw_user_meta_data->>'name'), ''),
        'Investigator'
      ),
      120
    ),
    'investigator',
    'standard',
    'standard',
    true,
    true
  FROM auth.users
  WHERE id = auth.uid()
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_public_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_public_onboarding() TO authenticated;

COMMIT;
