from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import Field, field_validator, model_validator

from .common import ApiModel


class TimePrecision(StrEnum):
    EXACT = "EXACT"
    APPROX = "APPROX"
    WINDOW = "WINDOW"
    DATE = "DATE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class Confidence(StrEnum):
    VERIFIED = "VERIFIED"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    DEMO = "DEMO"


class CoordinateStatus(StrEnum):
    VERIFIED_VENUE = "VERIFIED_VENUE"
    VERIFIED_LOCALITY = "VERIFIED_LOCALITY"
    NEEDS_VERIFICATION = "NEEDS_VERIFICATION"


class SourceRecord(ApiModel):
    investigation_id: str
    source_ref: str = Field(min_length=1)
    time_precision: TimePrecision
    confidence: Confidence
    source_evidence_id: str | None = None
    source_locator: dict | None = None


class GraphPosition(ApiModel):
    x: float
    y: float


class CasualtyBreakdown(ApiModel):
    id: str
    label: str
    killed: int = Field(ge=0)
    injured: int = Field(ge=0)


class LocationResponse(SourceRecord):
    id: str
    title: str
    expanded_name: str | None = None
    alternative_label: str | None = None
    type: str
    filter_groups: list[str]
    date: str
    time_label: str
    importance: str
    coordinates: tuple[float, float] | None = None
    coordinate_status: CoordinateStatus
    coordinate_source_ref: str | None = None
    intensity: float = Field(ge=0)
    description: str
    assigned_team: str | None = None
    killed: int | None = Field(default=None, ge=0)
    injured: int | None = Field(default=None, ge=0)
    casualty_breakdown: list[CasualtyBreakdown] | None = None
    clearance: str | None = None
    graph_node_id: str | None = None
    linked_entity_ids: list[str]
    linked_timeline_event_ids: list[str]

    @field_validator("coordinates")
    @classmethod
    def valid_coordinates(
        cls, value: tuple[float, float] | None
    ) -> tuple[float, float] | None:
        if value is None:
            return None
        longitude, latitude = value
        if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
            raise ValueError("Coordinates are outside valid longitude/latitude ranges")
        return value

    @model_validator(mode="after")
    def missing_coordinates_are_explicit(self) -> "LocationResponse":
        if self.coordinates is None and self.coordinate_status != CoordinateStatus.NEEDS_VERIFICATION:
            raise ValueError("Locations without coordinates must need verification")
        return self


class RouteResponse(SourceRecord):
    id: str
    label: str
    team_label: str
    member_entity_ids: list[str]
    location_ids: list[str]
    description: str


class GraphNodeResponse(SourceRecord):
    id: str
    label: str
    kind: str
    subtitle: str
    status: str | None = None
    risk: str | None = None
    position: GraphPosition
    date_range: tuple[str, str] | None = None


class GraphEdgeResponse(SourceRecord):
    id: str
    source: str
    target: str
    link_kind: str
    label: str


class GraphFilterResponse(ApiModel):
    id: str
    label: str
    tone: str
    dark_tone: str


class TimelineEventResponse(SourceRecord):
    id: str
    date: str
    time: str
    sort_order: int
    timezone: str
    category: str
    title: str
    description: str
    severity: int = Field(ge=0)
    linked_entity_ids: list[str]
    linked_location_ids: list[str]
    event_time: datetime | None = None
    end_time: datetime | None = None


class FactResponse(SourceRecord):
    id: str
    type: str
    text: str
    status: str
    source_title: str
    linked_entity_ids: list[str]
    linked_timeline_event_ids: list[str]
    linked_location_ids: list[str]


class CasualtyRecordResponse(SourceRecord):
    id: str
    location_id: str
    label: str
    killed: int = Field(ge=0)
    injured: int = Field(ge=0)


class VerifiedTotals(ApiModel):
    attackers_involved: int = Field(ge=0)
    attackers_killed: int = Field(ge=0)
    attackers_captured: int = Field(ge=0)
    people_killed: int = Field(ge=0)
    people_injured: int = Field(ge=0)
    security_personnel_killed: int = Field(ge=0)
    foreign_nationals_killed: int = Field(ge=0)


class InvestigationSummary(ApiModel):
    id: str
    slug: str
    name: str
    short_name: str
    type: str
    description: str
    location: str
    start_time: str
    end_time: str
    timezone: str
    status: str
    classification: str
    is_demo: bool


class InvestigationDetail(ApiModel):
    id: str
    case_id: str
    slug: str
    name: str
    short_name: str
    display_name: str
    type: str
    desk_label: str
    case_type: str
    location: str
    start: str
    end: str
    timezone: str
    overall_status: str
    summary: str
    badge: str
    historical_note: str | None = None
    verified_totals: VerifiedTotals | None = None
    classification: str
    is_demo: bool
    graph_filters: list[GraphFilterResponse]
    casualty_ledger: list[CasualtyRecordResponse]
    source_ref: str = Field(min_length=1)
    time_precision: TimePrecision
    confidence: Confidence


class InvestigationMapResponse(ApiModel):
    investigation_id: str
    center: tuple[float, float]
    zoom: float
    bounds_label: str
    filter_groups: list[str]
    locations: list[LocationResponse]
    routes: list[RouteResponse]
    density_notice: str | None = None


class InvestigationNetworkResponse(ApiModel):
    investigation_id: str
    nodes: list[GraphNodeResponse]
    edges: list[GraphEdgeResponse]

    @model_validator(mode="after")
    def edges_reference_nodes(self) -> "InvestigationNetworkResponse":
        node_ids = {node.id for node in self.nodes}
        if any(edge.source not in node_ids or edge.target not in node_ids for edge in self.edges):
            raise ValueError("Network contains an orphan edge")
        return self


class InvestigationTimelineResponse(ApiModel):
    investigation_id: str
    start_date: str
    end_date: str
    events: list[TimelineEventResponse]


class InvestigationFactsResponse(ApiModel):
    investigation_id: str
    facts: list[FactResponse]
    total: int = Field(ge=0)
    limit: int = Field(ge=1)
    offset: int = Field(ge=0)


class InvestigationCounts(ApiModel):
    locations: int = Field(ge=0)
    entities: int = Field(ge=0)
    relationships: int = Field(ge=0)
    timeline_events: int = Field(ge=0)
    facts: int = Field(ge=0)


class InvestigationOverview(ApiModel):
    metadata: InvestigationDetail
    counts: InvestigationCounts


class EntityDetailsResponse(ApiModel):
    entity: GraphNodeResponse
    relationships: list[GraphEdgeResponse]
    locations: list[LocationResponse]
    timeline_events: list[TimelineEventResponse]
    facts: list[FactResponse]


class LocationDetailsResponse(ApiModel):
    location: LocationResponse
    related_entities: list[GraphNodeResponse]
    timeline_events: list[TimelineEventResponse]
    facts: list[FactResponse]


class AuditLogResponse(ApiModel):
    id: str
    user_id: str
    agent_id: str
    action: str
    resource_type: str
    resource_id: str | None = None
    investigation_id: str | None = None
    success: bool
    created_at: datetime


ImportanceQuery = Annotated[list[str] | None, Field(default=None)]
