BEGIN;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS clearance_level VARCHAR(30);
UPDATE public.profiles
SET clearance_level = clearance
WHERE clearance_level IS NULL;
ALTER TABLE public.profiles
    ALTER COLUMN clearance_level SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.investigations (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    investigation_type TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL,
    status TEXT NOT NULL,
    classification TEXT NOT NULL DEFAULT 'standard',
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT investigations_time_order CHECK (end_time >= start_time),
    CONSTRAINT investigations_slug_not_blank CHECK (btrim(slug) <> '')
);

CREATE TABLE IF NOT EXISTS public.investigation_access (
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    role TEXT,
    granted_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (investigation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.investigation_locations (
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT,
    location_type TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    coordinate_status TEXT NOT NULL,
    description TEXT NOT NULL,
    killed INTEGER CHECK (killed IS NULL OR killed >= 0),
    injured INTEGER CHECK (injured IS NULL OR injured >= 0),
    importance TEXT NOT NULL,
    filter_groups TEXT[] NOT NULL DEFAULT '{}',
    source_ref TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL,
    PRIMARY KEY (investigation_id, id),
    CONSTRAINT investigation_locations_latitude CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT investigation_locations_longitude CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CONSTRAINT investigation_locations_coordinate_integrity CHECK (
        (latitude IS NOT NULL AND longitude IS NOT NULL)
        OR coordinate_status = 'NEEDS_VERIFICATION'
    )
);

CREATE TABLE IF NOT EXISTS public.investigation_routes (
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    source_ref TEXT NOT NULL,
    metadata JSONB NOT NULL,
    PRIMARY KEY (investigation_id, id)
);

CREATE TABLE IF NOT EXISTS public.investigation_entities (
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT,
    status TEXT,
    description TEXT NOT NULL DEFAULT '',
    source_ref TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL,
    PRIMARY KEY (investigation_id, id)
);

CREATE TABLE IF NOT EXISTS public.investigation_relationships (
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    source_entity_id TEXT NOT NULL,
    target_entity_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    label TEXT NOT NULL,
    confidence TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL,
    PRIMARY KEY (investigation_id, id),
    FOREIGN KEY (investigation_id, source_entity_id)
        REFERENCES public.investigation_entities(investigation_id, id) ON DELETE CASCADE,
    FOREIGN KEY (investigation_id, target_entity_id)
        REFERENCES public.investigation_entities(investigation_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.timeline_events (
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    time_precision TEXT NOT NULL,
    timezone TEXT NOT NULL,
    location_id TEXT,
    source_ref TEXT NOT NULL,
    confidence TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL,
    PRIMARY KEY (investigation_id, id),
    FOREIGN KEY (investigation_id, location_id)
        REFERENCES public.investigation_locations(investigation_id, id) ON DELETE SET NULL,
    CONSTRAINT timeline_events_precision_valid CHECK (
        time_precision IN ('EXACT', 'APPROX', 'WINDOW', 'DATE', 'NOT_APPLICABLE')
    )
);

CREATE TABLE IF NOT EXISTS public.evidence_facts (
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    fact_type TEXT NOT NULL,
    statement TEXT NOT NULL,
    verification_status TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    confidence TEXT NOT NULL,
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (investigation_id, id),
    CONSTRAINT evidence_facts_status_valid CHECK (
        upper(verification_status) IN ('VERIFIED', 'PENDING', 'DISPUTED', 'DEMO')
    )
);

CREATE TABLE IF NOT EXISTS public.evidence_fact_entities (
    investigation_id TEXT NOT NULL,
    fact_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    PRIMARY KEY (investigation_id, fact_id, entity_id),
    FOREIGN KEY (investigation_id, fact_id)
        REFERENCES public.evidence_facts(investigation_id, id) ON DELETE CASCADE,
    FOREIGN KEY (investigation_id, entity_id)
        REFERENCES public.investigation_entities(investigation_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.evidence_fact_locations (
    investigation_id TEXT NOT NULL,
    fact_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    PRIMARY KEY (investigation_id, fact_id, location_id),
    FOREIGN KEY (investigation_id, fact_id)
        REFERENCES public.evidence_facts(investigation_id, id) ON DELETE CASCADE,
    FOREIGN KEY (investigation_id, location_id)
        REFERENCES public.investigation_locations(investigation_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.evidence_fact_events (
    investigation_id TEXT NOT NULL,
    fact_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    PRIMARY KEY (investigation_id, fact_id, event_id),
    FOREIGN KEY (investigation_id, fact_id)
        REFERENCES public.evidence_facts(investigation_id, id) ON DELETE CASCADE,
    FOREIGN KEY (investigation_id, event_id)
        REFERENCES public.timeline_events(investigation_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    agent_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    investigation_id TEXT REFERENCES public.investigations(id) ON DELETE SET NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS investigation_locations_investigation_idx
    ON public.investigation_locations (investigation_id);
CREATE INDEX IF NOT EXISTS investigation_entities_investigation_idx
    ON public.investigation_entities (investigation_id);
CREATE INDEX IF NOT EXISTS investigation_relationships_investigation_idx
    ON public.investigation_relationships (investigation_id);
CREATE INDEX IF NOT EXISTS timeline_events_investigation_time_idx
    ON public.timeline_events (investigation_id, event_time);
CREATE INDEX IF NOT EXISTS evidence_facts_investigation_idx
    ON public.evidence_facts (investigation_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx
    ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_investigation_idx
    ON public.audit_logs (investigation_id, created_at DESC);

ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_fact_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_fact_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_fact_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.investigations FROM anon, authenticated;
REVOKE ALL ON TABLE public.investigation_access FROM anon, authenticated;
REVOKE ALL ON TABLE public.investigation_locations FROM anon, authenticated;
REVOKE ALL ON TABLE public.investigation_routes FROM anon, authenticated;
REVOKE ALL ON TABLE public.investigation_entities FROM anon, authenticated;
REVOKE ALL ON TABLE public.investigation_relationships FROM anon, authenticated;
REVOKE ALL ON TABLE public.timeline_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.evidence_facts FROM anon, authenticated;
REVOKE ALL ON TABLE public.evidence_fact_entities FROM anon, authenticated;
REVOKE ALL ON TABLE public.evidence_fact_locations FROM anon, authenticated;
REVOKE ALL ON TABLE public.evidence_fact_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated;

ALTER TABLE public.investigation_pins
    ADD COLUMN IF NOT EXISTS investigation_id TEXT;
UPDATE public.investigation_pins
SET investigation_id = case_id
WHERE investigation_id IS NULL;
ALTER TABLE public.investigation_pins
    ALTER COLUMN investigation_id SET NOT NULL;
ALTER TABLE public.investigation_pins
    DROP CONSTRAINT IF EXISTS investigation_pins_investigation_fk;
ALTER TABLE public.investigation_pins
    ADD CONSTRAINT investigation_pins_investigation_fk
    FOREIGN KEY (investigation_id) REFERENCES public.investigations(id) ON DELETE CASCADE
    NOT VALID;

ALTER TABLE public.investigation_pin_events
    ADD COLUMN IF NOT EXISTS investigation_id TEXT;
UPDATE public.investigation_pin_events
SET investigation_id = case_id
WHERE investigation_id IS NULL;

COMMENT ON COLUMN public.investigation_pins.case_id IS
    'Deprecated compatibility column. Use investigation_id; Liveblocks room IDs are unrelated.';
COMMENT ON COLUMN public.investigation_pins.investigation_id IS
    'Authoritative investigation identifier. Never populated from a Liveblocks room ID.';
COMMENT ON TABLE public.audit_logs IS
    'Security-safe audit metadata. Tokens, authorization headers, and passkey responses are prohibited.';

COMMIT;
