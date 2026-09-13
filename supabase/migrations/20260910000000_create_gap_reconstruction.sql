BEGIN;

CREATE TABLE public.investigation_cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    label VARCHAR(160) NOT NULL CHECK (btrim(label) <> ''),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    source_ref TEXT NOT NULL CHECK (btrim(source_ref) <> ''),
    is_synthetic BOOLEAN NOT NULL DEFAULT FALSE,
    operational_from TIMESTAMPTZ,
    operational_to TIMESTAMPTZ,
    recording_availability TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (recording_availability IN ('AVAILABLE','UNAVAILABLE','UNKNOWN')),
    retention_information TEXT,
    verified_orientation JSONB,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (operational_from IS NULL OR operational_to IS NULL OR operational_to >= operational_from)
);

CREATE TABLE public.gap_reconstruction_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    investigator_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    entity_id TEXT NOT NULL,
    algorithm_version TEXT NOT NULL,
    input_snapshot JSONB NOT NULL,
    result_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (investigation_id, entity_id) REFERENCES public.investigation_entities(investigation_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.gap_camera_reviews (
    run_id UUID NOT NULL REFERENCES public.gap_reconstruction_runs(id) ON DELETE CASCADE,
    camera_id UUID NOT NULL REFERENCES public.investigation_cameras(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'NOT_REVIEWED' CHECK (status IN ('NOT_REVIEWED','REQUESTED','FOOTAGE_UNAVAILABLE','REVIEWED_NO_RELEVANT_FINDING','RELEVANT_FOOTAGE_FOUND')),
    notes TEXT NOT NULL DEFAULT '',
    evidence_id UUID REFERENCES public.evidence_items(id) ON DELETE SET NULL,
    reviewed_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (run_id, camera_id)
);

CREATE INDEX investigation_cameras_case_idx ON public.investigation_cameras(investigation_id, label);
CREATE INDEX gap_reconstruction_runs_case_idx ON public.gap_reconstruction_runs(investigation_id, created_at DESC);

ALTER TABLE public.investigation_cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gap_reconstruction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gap_camera_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.investigation_cameras FROM anon, authenticated;
REVOKE ALL ON TABLE public.gap_reconstruction_runs FROM anon, authenticated;
REVOKE ALL ON TABLE public.gap_camera_reviews FROM anon, authenticated;

COMMENT ON TABLE public.investigation_cameras IS 'Case-scoped camera inventory, separate from canonical case evidence; direct browser writes are denied.';
COMMENT ON TABLE public.gap_reconstruction_runs IS 'Immutable snapshots of analyst-selected straight-line reachability assumptions and results; never verified evidence.';
COMMENT ON TABLE public.gap_camera_reviews IS 'Review workflow records. Candidate status does not assert footage availability, capture, or guilt.';

COMMIT;
