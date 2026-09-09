BEGIN;

CREATE TABLE IF NOT EXISTS public.evidence_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    display_sequence BIGINT NOT NULL UNIQUE,
    display_id TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    storage_reference TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    description TEXT NOT NULL DEFAULT '',
    processing_status TEXT NOT NULL DEFAULT 'UPLOADED',
    uploaded_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    uploaded_by_agent TEXT NOT NULL,
    uploaded_by_name TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    extraction_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT evidence_processing_status_valid CHECK (processing_status IN (
        'UPLOADED','EXTRACTING','AI_ANALYZING','PENDING_REVIEW',
        'PARTIALLY_REVIEWED','APPROVED','REJECTED','FAILED'
    ))
);

CREATE TABLE IF NOT EXISTS public.evidence_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL REFERENCES public.evidence_items(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    raw_extraction_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    derived_content TEXT NOT NULL,
    derived_locator_kind TEXT NOT NULL,
    model_provider TEXT NOT NULL,
    model_identifier TEXT NOT NULL,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE (evidence_id)
);

CREATE TABLE IF NOT EXISTS public.extraction_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    extraction_id UUID NOT NULL REFERENCES public.evidence_extractions(id) ON DELETE CASCADE,
    candidate_type TEXT NOT NULL CHECK (candidate_type IN ('ENTITY','LOCATION','EVENT','DATE_TIME','RELATIONSHIP','CONFLICT')),
    candidate_payload JSONB NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING','ACCEPTED','EDITED_ACCEPTED','REJECTED')),
    reviewed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_resource_type TEXT,
    created_resource_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.entity_resolution_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.extraction_candidates(id) ON DELETE CASCADE,
    existing_entity_id TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('MERGE','CREATE_SEPARATE')),
    reviewed_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (candidate_id)
);

CREATE TABLE IF NOT EXISTS public.potential_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    evidence_id UUID REFERENCES public.evidence_items(id) ON DELETE SET NULL,
    conflict_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REVIEWED','DISMISSED','RESOLVED')),
    reviewed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.case_report_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'AI_ASSISTED_DRAFT',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    requested_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.investigation_entities ADD COLUMN IF NOT EXISTS source_evidence_id UUID REFERENCES public.evidence_items(id) ON DELETE SET NULL;
ALTER TABLE public.investigation_entities ADD COLUMN IF NOT EXISTS source_locator JSONB;
ALTER TABLE public.investigation_locations ADD COLUMN IF NOT EXISTS source_evidence_id UUID REFERENCES public.evidence_items(id) ON DELETE SET NULL;
ALTER TABLE public.investigation_locations ADD COLUMN IF NOT EXISTS source_locator JSONB;
ALTER TABLE public.investigation_relationships ADD COLUMN IF NOT EXISTS source_evidence_id UUID REFERENCES public.evidence_items(id) ON DELETE SET NULL;
ALTER TABLE public.investigation_relationships ADD COLUMN IF NOT EXISTS source_locator JSONB;
ALTER TABLE public.timeline_events ADD COLUMN IF NOT EXISTS source_evidence_id UUID REFERENCES public.evidence_items(id) ON DELETE SET NULL;
ALTER TABLE public.timeline_events ADD COLUMN IF NOT EXISTS source_locator JSONB;
ALTER TABLE public.evidence_facts ADD COLUMN IF NOT EXISTS source_evidence_id UUID REFERENCES public.evidence_items(id) ON DELETE SET NULL;
ALTER TABLE public.evidence_facts ADD COLUMN IF NOT EXISTS source_locator JSONB;
ALTER TABLE public.evidence_facts ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL;
ALTER TABLE public.evidence_facts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS evidence_items_investigation_idx ON public.evidence_items (investigation_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS evidence_extractions_evidence_idx ON public.evidence_extractions (evidence_id);
CREATE INDEX IF NOT EXISTS extraction_candidates_extraction_idx ON public.extraction_candidates (extraction_id, review_status);
CREATE INDEX IF NOT EXISTS potential_conflicts_investigation_idx ON public.potential_conflicts (investigation_id, status);
CREATE INDEX IF NOT EXISTS case_report_drafts_investigation_idx ON public.case_report_drafts (investigation_id, created_at DESC);

ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_resolution_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.potential_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_report_drafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.evidence_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.evidence_extractions FROM anon, authenticated;
REVOKE ALL ON TABLE public.extraction_candidates FROM anon, authenticated;
REVOKE ALL ON TABLE public.entity_resolution_reviews FROM anon, authenticated;
REVOKE ALL ON TABLE public.potential_conflicts FROM anon, authenticated;
REVOKE ALL ON TABLE public.case_report_drafts FROM anon, authenticated;

COMMENT ON TABLE public.evidence_items IS 'Pilot evidence ingestion metadata. SHA-256 is a file-integrity hash, not a legal certification.';
COMMENT ON TABLE public.extraction_candidates IS 'Unverified AI/deterministic candidates. Rows enter case data only after human review and explicit commit.';

COMMIT;
