BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_id VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    role VARCHAR(50) NOT NULL,
    clearance VARCHAR(30) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT profiles_agent_id_not_blank CHECK (btrim(agent_id) <> ''),
    CONSTRAINT profiles_display_name_not_blank CHECK (btrim(display_name) <> ''),
    CONSTRAINT profiles_role_not_blank CHECK (btrim(role) <> ''),
    CONSTRAINT profiles_clearance_not_blank CHECK (btrim(clearance) <> '')
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Investigators can read their own authorization profile"
    ON public.profiles;

CREATE POLICY "Investigators can read their own authorization profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

COMMENT ON TABLE public.profiles IS
    'Server-administered CrimeLens authorization metadata linked to Supabase Auth users.';
COMMENT ON COLUMN public.profiles.agent_id IS
    'Display identifier only. Never accepted as an authentication secret.';
COMMENT ON COLUMN public.profiles.role IS
    'Admin-controlled authorization role. No authenticated-user write policy exists.';
COMMENT ON COLUMN public.profiles.clearance IS
    'Admin-controlled clearance label. No authenticated-user write policy exists.';

COMMIT;

