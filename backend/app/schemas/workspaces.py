from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import Field

from .common import ApiModel


NodeType = Literal[
    "person", "organization", "location", "vehicle", "device", "phone",
    "account", "transaction", "event", "evidence", "document", "note", "custom",
]
Verification = Literal["verified", "manual", "hypothesis"]
SourceVerification = Literal["verified", "pending", "disputed", "demo"]
Confidence = Literal["confirmed", "high", "medium", "low", "hypothesis"]
IntelligenceOrigin = Literal["CASE_DATABASE", "INVESTIGATOR_CREATED", "AI_SUGGESTED_ANALYST_ACCEPTED"]


class Position(ApiModel):
    x: float
    y: float


class Viewport(ApiModel):
    x: float = 0
    y: float = 0
    zoom: float = Field(default=1, gt=0, le=5)


class WorkspaceFilters(ApiModel):
    verification: list[Verification] = Field(default_factory=lambda: ["verified", "manual", "hypothesis"])


class WorkspaceNode(ApiModel):
    id: UUID
    type: NodeType
    label: str = Field(min_length=1, max_length=120)
    origin: Literal["manual", "investigation"]
    verification_status: Verification
    source_verification_status: SourceVerification | None = None
    source_entity_id: str | None = Field(default=None, max_length=120)
    source_event_id: str | None = Field(default=None, max_length=120)
    source_location_id: str | None = Field(default=None, max_length=120)
    source_fact_id: str | None = Field(default=None, max_length=120)
    investigation_id: str | None = Field(default=None, max_length=80)
    description: str = Field(default="", max_length=4000)
    metadata: dict[str, Any] = Field(default_factory=dict)
    intelligence_origin: IntelligenceOrigin | None = None
    position: Position


class WorkspaceBasisReference(ApiModel):
    id: str = Field(min_length=1, max_length=160)
    resource_type: Literal["entity", "location", "event", "fact", "document", "analyst_note"]
    label: str = Field(min_length=1, max_length=500)
    source_ref: str | None = Field(default=None, max_length=1000)
    verified: bool


class WorkspaceEdge(ApiModel):
    id: UUID
    source: UUID
    target: UUID
    relationship_type: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=80)
    confidence: Confidence
    verification_status: Verification
    reason: str = Field(default="", max_length=4000)
    source_ref: str | None = Field(default=None, max_length=500)
    basis: list[WorkspaceBasisReference] = Field(default_factory=list, max_length=100)
    intelligence_origin: IntelligenceOrigin | None = None


class WorkspaceGroup(ApiModel):
    id: UUID
    name: str = Field(min_length=1, max_length=120)
    group_type: str = Field(min_length=1, max_length=80)
    node_ids: list[UUID] = Field(default_factory=list)


QuestionStatus = Literal["OPEN", "UNDER_REVIEW", "PARTIALLY_ANSWERED", "RESOLVED", "CLOSED"]


class WorkspaceQuestionLink(ApiModel):
    resource_type: Literal["node", "edge", "evidence", "event", "note"]
    resource_id: str = Field(min_length=1, max_length=160)
    relationship: Literal["SUPPORTS", "CONTRADICTS", "RELATED"]


class WorkspaceQuestion(ApiModel):
    id: UUID
    question_text: str = Field(min_length=1, max_length=2000)
    status: QuestionStatus = "OPEN"
    notes: str = Field(default="", max_length=10000)
    links: list[WorkspaceQuestionLink] = Field(default_factory=list, max_length=500)
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None = None


class WorkspaceSuggestion(ApiModel):
    id: UUID
    signature: str = Field(min_length=1, max_length=1000)
    source_node_id: UUID
    target_node_id: UUID
    suggested_relationship: str = Field(min_length=1, max_length=80)
    status: Literal["PENDING", "ACCEPTED_AS_HYPOTHESIS", "REJECTED"] = "PENDING"
    reason_codes: list[Literal["SHARED_LOCATION", "TEMPORAL_OVERLAP", "COMMON_EVIDENCE_REFERENCE", "EXISTING_CASE_PATH"]] = Field(default_factory=list, max_length=20)
    explanation: str = Field(min_length=1, max_length=4000)
    signal_strength: Literal["LOW", "MEDIUM", "HIGH"]
    created_at: datetime
    reviewed_at: datetime | None = None


class WorkspaceConflict(ApiModel):
    id: UUID
    signature: str = Field(min_length=1, max_length=1000)
    conflict_type: Literal["TEMPORAL_CONFLICT", "ATTRIBUTE_CONFLICT", "RELATIONSHIP_CONFLICT", "SOURCE_DISAGREEMENT", "DUPLICATE_IDENTITY"]
    resource_a_type: Literal["node", "edge", "event", "fact"]
    resource_a_id: str = Field(min_length=1, max_length=160)
    resource_b_type: Literal["node", "edge", "event", "fact"]
    resource_b_id: str = Field(min_length=1, max_length=160)
    status: Literal["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"] = "OPEN"
    explanation: str = Field(min_length=1, max_length=4000)
    created_at: datetime
    reviewed_at: datetime | None = None


class WorkspaceSnapshotData(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    nodes: list[WorkspaceNode] = Field(default_factory=list, max_length=1000)
    edges: list[WorkspaceEdge] = Field(default_factory=list, max_length=3000)
    groups: list[WorkspaceGroup] = Field(default_factory=list, max_length=200)
    questions: list[WorkspaceQuestion] = Field(default_factory=list, max_length=500)
    suggestions: list[WorkspaceSuggestion] = Field(default_factory=list, max_length=1000)
    conflicts: list[WorkspaceConflict] = Field(default_factory=list, max_length=1000)
    viewport: Viewport = Field(default_factory=Viewport)
    filters: WorkspaceFilters = Field(default_factory=WorkspaceFilters)
    version: int = Field(default=1, ge=1)


class WorkspaceSnapshot(ApiModel):
    id: UUID
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    created_at: datetime
    snapshot_data: WorkspaceSnapshotData


class WorkspaceCreate(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)


class WorkspaceSummary(ApiModel):
    id: UUID
    investigation_id: str
    name: str
    description: str
    version: int
    created_at: datetime
    updated_at: datetime


class GraphWorkspace(WorkspaceSummary):
    owner_user_id: UUID
    nodes: list[WorkspaceNode] = Field(default_factory=list, max_length=1000)
    edges: list[WorkspaceEdge] = Field(default_factory=list, max_length=3000)
    groups: list[WorkspaceGroup] = Field(default_factory=list, max_length=200)
    questions: list[WorkspaceQuestion] = Field(default_factory=list, max_length=500)
    suggestions: list[WorkspaceSuggestion] = Field(default_factory=list, max_length=1000)
    conflicts: list[WorkspaceConflict] = Field(default_factory=list, max_length=1000)
    snapshots: list[WorkspaceSnapshot] = Field(default_factory=list, max_length=500)
    viewport: Viewport = Field(default_factory=Viewport)
    filters: WorkspaceFilters = Field(default_factory=WorkspaceFilters)


class WorkspaceSave(ApiModel):
    id: UUID
    investigation_id: str = Field(min_length=1, max_length=80)
    owner_user_id: UUID | None = None
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
    nodes: list[WorkspaceNode] = Field(default_factory=list, max_length=1000)
    edges: list[WorkspaceEdge] = Field(default_factory=list, max_length=3000)
    groups: list[WorkspaceGroup] = Field(default_factory=list, max_length=200)
    questions: list[WorkspaceQuestion] = Field(default_factory=list, max_length=500)
    suggestions: list[WorkspaceSuggestion] = Field(default_factory=list, max_length=1000)
    conflicts: list[WorkspaceConflict] = Field(default_factory=list, max_length=1000)
    snapshots: list[WorkspaceSnapshot] = Field(default_factory=list, max_length=500)
    viewport: Viewport = Field(default_factory=Viewport)
    filters: WorkspaceFilters = Field(default_factory=WorkspaceFilters)
    version: int = Field(default=1, ge=1)
    created_at: datetime
    updated_at: datetime


class WorkspacePathRequest(ApiModel):
    from_node_id: UUID
    to_node_id: UUID
    max_hops: int = Field(default=4, ge=1, le=8)
    relationship_types: list[str] = Field(default_factory=list, max_length=30)


class WorkspacePathResponse(ApiModel):
    found: bool
    node_ids: list[UUID] = Field(default_factory=list)
    edge_ids: list[UUID] = Field(default_factory=list)
    hops: int = 0


class WorkspaceAnalysisResponse(ApiModel):
    provider: Literal["deterministic", "openai"]
    ai_available: bool
    suggestions: list[WorkspaceSuggestion]
    conflicts: list[WorkspaceConflict]
    analyzed_node_count: int
    analyzed_edge_count: int
    evidence_reference_count: int


class SuggestionReview(ApiModel):
    status: Literal["ACCEPTED_AS_HYPOTHESIS", "REJECTED"]


class ConflictReview(ApiModel):
    status: Literal["REVIEWED", "RESOLVED", "DISMISSED"]


class QuestionCreate(ApiModel):
    question_text: str = Field(min_length=1, max_length=2000)
    notes: str = Field(default="", max_length=10000)
    links: list[WorkspaceQuestionLink] = Field(default_factory=list, max_length=500)


class QuestionUpdate(ApiModel):
    question_text: str | None = Field(default=None, min_length=1, max_length=2000)
    status: QuestionStatus | None = None
    notes: str | None = Field(default=None, max_length=10000)
    links: list[WorkspaceQuestionLink] | None = Field(default=None, max_length=500)


class SnapshotCreate(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=2000)
