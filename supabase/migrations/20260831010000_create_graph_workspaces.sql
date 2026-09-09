BEGIN;

CREATE TABLE IF NOT EXISTS public.graph_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id TEXT NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    viewport JSONB NOT NULL DEFAULT '{"x":0,"y":0,"zoom":1}'::jsonb,
    filters JSONB NOT NULL DEFAULT '{"verification":["verified","manual","hypothesis"]}'::jsonb,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT graph_workspaces_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS public.graph_workspace_nodes (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.graph_workspaces(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL,
    label VARCHAR(120) NOT NULL,
    origin TEXT NOT NULL CHECK (origin IN ('manual', 'investigation')),
    verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'manual', 'hypothesis')),
    source_entity_id TEXT,
    source_event_id TEXT,
    source_location_id TEXT,
    source_fact_id TEXT,
    description TEXT NOT NULL DEFAULT '',
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT graph_workspace_nodes_label_not_blank CHECK (btrim(label) <> '')
);

CREATE TABLE IF NOT EXISTS public.graph_workspace_edges (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.graph_workspaces(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES public.graph_workspace_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES public.graph_workspace_nodes(id) ON DELETE CASCADE,
    relationship_type VARCHAR(80) NOT NULL,
    label VARCHAR(80) NOT NULL,
    confidence TEXT NOT NULL CHECK (confidence IN ('confirmed', 'high', 'medium', 'low', 'hypothesis')),
    verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'manual', 'hypothesis')),
    reason TEXT NOT NULL DEFAULT '',
    source_ref TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT graph_workspace_edges_distinct_nodes CHECK (source_node_id <> target_node_id)
);

CREATE TABLE IF NOT EXISTS public.graph_workspace_groups (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.graph_workspaces(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    group_type VARCHAR(80) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.graph_workspace_group_nodes (
    group_id UUID NOT NULL REFERENCES public.graph_workspace_groups(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES public.graph_workspace_nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, node_id)
);

CREATE TABLE IF NOT EXISTS public.graph_workspace_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.graph_workspaces(id) ON DELETE CASCADE,
    node_id UUID REFERENCES public.graph_workspace_nodes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    x DOUBLE PRECISION,
    y DOUBLE PRECISION,
    created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS graph_workspaces_owner_case_idx ON public.graph_workspaces (owner_user_id, investigation_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS graph_workspace_nodes_workspace_idx ON public.graph_workspace_nodes (workspace_id);
CREATE INDEX IF NOT EXISTS graph_workspace_edges_workspace_idx ON public.graph_workspace_edges (workspace_id);
CREATE INDEX IF NOT EXISTS graph_workspace_groups_workspace_idx ON public.graph_workspace_groups (workspace_id);

ALTER TABLE public.graph_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_workspace_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_workspace_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_workspace_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_workspace_group_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_workspace_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.graph_workspaces FROM anon, authenticated;
REVOKE ALL ON TABLE public.graph_workspace_nodes FROM anon, authenticated;
REVOKE ALL ON TABLE public.graph_workspace_edges FROM anon, authenticated;
REVOKE ALL ON TABLE public.graph_workspace_groups FROM anon, authenticated;
REVOKE ALL ON TABLE public.graph_workspace_group_nodes FROM anon, authenticated;
REVOKE ALL ON TABLE public.graph_workspace_notes FROM anon, authenticated;

COMMENT ON TABLE public.graph_workspaces IS 'Owner-scoped investigator reasoning workspaces; never authoritative case data.';
COMMENT ON COLUMN public.graph_workspace_nodes.source_entity_id IS 'Read-only reference to an authoritative case entity. Deleting this row does not delete that entity.';

COMMIT;
