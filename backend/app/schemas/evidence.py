from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

from pydantic import ConfigDict, Field, field_validator

from .common import ApiModel


class EvidenceProcessingStatus(StrEnum):
    UPLOADED = "UPLOADED"
    EXTRACTING = "EXTRACTING"
    AI_ANALYZING = "AI_ANALYZING"
    PENDING_REVIEW = "PENDING_REVIEW"
    PARTIALLY_REVIEWED = "PARTIALLY_REVIEWED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class CandidateReviewStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    EDITED_ACCEPTED = "EDITED_ACCEPTED"
    REJECTED = "REJECTED"


CandidateType = Literal["ENTITY", "LOCATION", "EVENT", "DATE_TIME", "RELATIONSHIP", "CONFLICT"]


class EvidenceApiModel(ApiModel):
    model_config = ConfigDict(extra="ignore")


class EvidenceItemResponse(EvidenceApiModel):
    id: UUID
    investigation_id: str
    display_id: str
    source_type: str
    original_filename: str
    mime_type: str
    size_bytes: int = Field(ge=0)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    description: str
    processing_status: EvidenceProcessingStatus
    uploaded_by: str
    uploaded_by_name: str
    uploaded_at: datetime
    extraction_counts: dict[str, int] = Field(default_factory=dict)
    failure_reason: str | None = None
    created_at: datetime
    updated_at: datetime


class ExtractionCandidateResponse(EvidenceApiModel):
    id: UUID
    extraction_id: UUID
    candidate_type: CandidateType
    candidate_payload: dict[str, Any]
    review_status: CandidateReviewStatus
    reviewed_by: str | UUID | None = None
    reviewed_at: datetime | None = None
    created_resource_type: str | None = None
    created_resource_id: str | None = None
    created_at: datetime


class EvidenceExtractionResponse(EvidenceApiModel):
    id: UUID
    evidence_id: UUID
    status: EvidenceProcessingStatus
    provider: str
    model_identifier: str
    candidates: list[ExtractionCandidateResponse]
    counts: dict[str, int]
    created_at: datetime
    completed_at: datetime | None = None
    failure_reason: str | None = None


class CandidateReviewRequest(ApiModel):
    review_status: CandidateReviewStatus
    candidate_payload: dict[str, Any] | None = None

    @field_validator("review_status")
    @classmethod
    def pending_is_not_a_review_action(cls, value: CandidateReviewStatus) -> CandidateReviewStatus:
        if value == CandidateReviewStatus.PENDING:
            raise ValueError("A review action must accept, edit, or reject the candidate")
        return value


class CommitResponse(ApiModel):
    evidence_id: str
    already_committed: bool
    entities_created: int = 0
    entities_merged: int = 0
    locations_created: int = 0
    events_created: int = 0
    relationships_created: int = 0
    facts_created: int = 0


class SearchResult(ApiModel):
    id: str
    result_type: str
    title: str
    detail: str
    workspace: str


class ActivityEvent(ApiModel):
    id: str
    event_type: str
    resource_type: str
    resource_id: str | None = None
    agent_id: str
    created_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)


class InvestigationStatusResponse(ApiModel):
    verified_entities: int
    supported_links: int
    hypotheses: int
    open_conflicts: int
    open_questions: int
    unsourced_relationships: int
    pending_review: int
    readiness_items: list[dict[str, Any]]


class ReportRequest(ApiModel):
    include: list[str] = Field(default_factory=list, max_length=20)


class ReportDraftResponse(ApiModel):
    id: str
    investigation_id: str
    status: str
    title: str
    content: str
    created_at: datetime
