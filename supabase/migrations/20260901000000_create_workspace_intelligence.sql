BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_questions (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.graph_workspaces(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'PARTIALLY_ANSWERED', 'RESOLVED', 'CLOSED')),
    notes TEXT NOT NULL DEFAULT '',
    resolved_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workspace_questions_text_not_blank CHECK (btrim(question_text) <> '')
);

CREATE TABLE IF NOT EXISTS public.workspace_question_links (
    question_id UUID NOT NULL REFERENCES public.workspace_questions(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('node', 'edge', 'evidence', 'event', 'note')),
    resource_id TEXT NOT NULL,
    relationship_to_question TEXT NOT NULL CHECK (relationship_to_question IN ('SUPPORTS', 'CONTRADICTS', 'RELATED')),
    PRIMARY KEY (question_id, resource_type, resource_id, relationship_to_question)
);

CREATE TABLE IF NOT EXISTS public.workspace_snapshots (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.graph_workspaces(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    snapshot_data JSONB NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workspace_snapshots_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS public.workspace_ai_suggestions (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.graph_workspaces(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES public.graph_workspace_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.graph_workspace_nodes(id) ON DELETE CASCADE,
    suggested_relationship VARCHAR(80) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED_AS_HYPOTHESIS', 'REJECTED')),
    reason_codes TEXT[] NOT NULL DEFAULT '{}',
    explanation TEXT NOT NULL,
    signal_strength TEXT NOT NULL CHECK (signal_strength IN ('LOW', 'MEDIUM', 'HIGH')),
    reviewed_by UUID REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT workspace_ai_suggestions_distinct_nodes CHECK (source_node_id <> target_node_id)
);

CREATE TABLE IF NOT EXISTS public.workspace_conflicts (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.graph_workspaces(id) ON DELETE CASCADE,
    conflict_type TEXT NOT NULL CHECK (conflict_type IN ('TEMPORAL_CONFLICT', 'ATTRIBUTE_CONFLICT', 'RELATIONSHIP_CONFLICT', 'SOURCE_DISAGREEMENT', 'DUPLICATE_IDENTITY')),
    resource_a_type TEXT NOT NULL CHECK (resource_a_type IN ('node', 'edge', 'event', 'fact')),
    resource_a_id TEXT NOT NULL,
    resource_b_type TEXT NOT NULL CHECK (resource_b_type IN ('node', 'edge', 'event', 'fact')),
    resource_b_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('OPEN', 'REVIEWED', 'RESOLVED', 'DISMISSED')),
    explanation TEXT NOT NULL,
    reviewed_by UUID REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workspace_questions_workspace_idx ON public.workspace_questions (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS workspace_snapshots_workspace_idx ON public.workspace_snapshots (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS workspace_suggestions_workspace_idx ON public.workspace_ai_suggestions (workspace_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS workspace_conflicts_workspace_idx ON public.workspace_conflicts (workspace_id, status, created_at DESC);

ALTER TABLE public.workspace_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_question_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_conflicts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.workspace_questions FROM anon, authenticated;
REVOKE ALL ON TABLE public.workspace_question_links FROM anon, authenticated;
REVOKE ALL ON TABLE public.workspace_snapshots FROM anon, authenticated;
REVOKE ALL ON TABLE public.workspace_ai_suggestions FROM anon, authenticated;
REVOKE ALL ON TABLE public.workspace_conflicts FROM anon, authenticated;

COMMENT ON TABLE public.workspace_ai_suggestions IS 'Unverified, analyst-reviewable connection suggestions. Acceptance creates a hypothesis only.';
COMMENT ON TABLE public.workspace_conflicts IS 'Potential deterministic inconsistencies requiring analyst review; not declarations that evidence is false.';
COMMENT ON TABLE public.workspace_snapshots IS 'Analyst-controlled reasoning-state snapshots containing references rather than duplicated authoritative case data.';

COMMIT;
