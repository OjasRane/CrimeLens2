BEGIN;

-- Existing profiles retain their current roles, clearance and access behavior.
ALTER TABLE public.profiles ADD COLUMN public_account BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.investigations ADD COLUMN owner_user_id UUID REFERENCES public.profiles(user_id) ON DELETE RESTRICT;
ALTER TABLE public.investigations ADD COLUMN creation_key UUID;
CREATE UNIQUE INDEX investigations_owner_creation_key ON public.investigations(owner_user_id, creation_key);
ALTER TABLE public.investigation_pins DROP CONSTRAINT IF EXISTS investigation_pins_case_id_known;

-- Mark only newly created identities. Do not backfill or migrate existing users.
CREATE TABLE public.public_registrations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.public_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_registrations FROM anon, authenticated;
CREATE FUNCTION public.register_public_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.public_registrations(user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER crimelens_public_identity AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.register_public_identity();

-- Only a verified session can provision its own minimum-access profile.
-- Client metadata supplies a display label only, never authorization fields.
CREATE FUNCTION public.complete_public_onboarding() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u JOIN public.public_registrations r ON r.user_id=u.id
    WHERE u.id=auth.uid() AND u.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Verified public registration required' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.profiles(user_id,agent_id,display_name,role,clearance,clearance_level,active,public_account)
  SELECT id, 'CR-' || id::text,
    left(coalesce(nullif(btrim(raw_user_meta_data->>'display_name'),''),'Investigator'),120),
    'investigator','standard','standard',true,true
  FROM auth.users WHERE id=auth.uid()
  ON CONFLICT(user_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.register_public_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_public_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_public_onboarding() TO authenticated;
COMMIT;
