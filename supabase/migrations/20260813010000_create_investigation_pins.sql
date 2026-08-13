BEGIN;

CREATE TABLE IF NOT EXISTS public.investigation_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id VARCHAR(50) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    title VARCHAR(120) NOT NULL,
    category VARCHAR(40) NOT NULL,
    description VARCHAR(2000),
    occurred_at TIMESTAMP WITH TIME ZONE,
    linked_evidence_id VARCHAR(100),
    linked_suspect_id VARCHAR(100),
    linked_timeline_event_id VARCHAR(100),
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT investigation_pins_case_id_known CHECK (
        case_id IN ('demo', 'mumbai-2611')
    ),
    CONSTRAINT investigation_pins_latitude_valid CHECK (
        latitude >= -90 AND latitude <= 90
    ),
    CONSTRAINT investigation_pins_longitude_valid CHECK (
        longitude >= -180 AND longitude <= 180
    ),
    CONSTRAINT investigation_pins_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT investigation_pins_category_valid CHECK (
        category IN (
            'crime_scene',
            'evidence',
            'cctv',
            'suspect_sighting',
            'witness',
            'point_of_interest',
            'lead',
            'custom'
        )
    )
);

CREATE INDEX IF NOT EXISTS investigation_pins_case_created_idx
    ON public.investigation_pins (case_id, created_at);
CREATE INDEX IF NOT EXISTS investigation_pins_creator_idx
    ON public.investigation_pins (created_by);

CREATE TABLE IF NOT EXISTS public.investigation_pin_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pin_id UUID NOT NULL,
    case_id VARCHAR(50) NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    action VARCHAR(30) NOT NULL,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT investigation_pin_events_action_valid CHECK (
        action IN ('PIN_CREATED', 'PIN_UPDATED', 'PIN_DELETED')
    )
);

CREATE INDEX IF NOT EXISTS investigation_pin_events_case_created_idx
    ON public.investigation_pin_events (case_id, created_at);
CREATE INDEX IF NOT EXISTS investigation_pin_events_pin_idx
    ON public.investigation_pin_events (pin_id);

ALTER TABLE public.investigation_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_pin_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.investigation_pins FROM anon, authenticated;
REVOKE ALL ON TABLE public.investigation_pin_events FROM anon, authenticated;

COMMENT ON TABLE public.investigation_pins IS
    'Case-scoped investigator annotations. All access is mediated by authenticated CrimeLens API routes.';
COMMENT ON TABLE public.investigation_pin_events IS
    'Append-only audit snapshots for investigation pin create, update, and delete actions.';
COMMENT ON COLUMN public.investigation_pins.created_by IS
    'Derived from the verified Supabase session; never accepted from a client payload.';

COMMIT;
