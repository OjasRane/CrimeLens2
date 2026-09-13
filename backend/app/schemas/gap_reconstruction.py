from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from math import isfinite
from typing import Any

from pydantic import Field, field_validator, model_validator

from .common import ApiModel


class Availability(StrEnum):
    AVAILABLE = "AVAILABLE"
    UNAVAILABLE = "UNAVAILABLE"
    UNKNOWN = "UNKNOWN"


class ReviewStatus(StrEnum):
    NOT_REVIEWED = "NOT_REVIEWED"
    REQUESTED = "REQUESTED"
    FOOTAGE_UNAVAILABLE = "FOOTAGE_UNAVAILABLE"
    REVIEWED_NO_RELEVANT_FINDING = "REVIEWED_NO_RELEVANT_FINDING"
    RELEVANT_FOOTAGE_FOUND = "RELEVANT_FOOTAGE_FOUND"


class Coordinates(ApiModel):
    latitude: float
    longitude: float

    @model_validator(mode="after")
    def valid(self) -> "Coordinates":
        if not isfinite(self.latitude) or not isfinite(self.longitude) or not -90 <= self.latitude <= 90 or not -180 <= self.longitude <= 180:
            raise ValueError("Coordinates must be finite and valid")
        return self


class CameraCreate(ApiModel):
    label: str = Field(min_length=1, max_length=160)
    coordinates: Coordinates
    source_ref: str = Field(min_length=1, max_length=500)
    is_synthetic: bool = False
    operational_from: datetime | None = None
    operational_to: datetime | None = None
    recording_availability: Availability = Availability.UNKNOWN
    retention_information: str | None = Field(default=None, max_length=1000)
    verified_orientation: dict[str, Any] | None = None

    @field_validator("operational_from", "operational_to")
    @classmethod
    def operational_dates_are_aware(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("Operational dates must include timezone offsets")
        return value

    @model_validator(mode="after")
    def dates_in_order(self) -> "CameraCreate":
        if self.operational_from and self.operational_to and self.operational_to < self.operational_from:
            raise ValueError("Operational end must not precede start")
        return self


class CameraUpdate(ApiModel):
    label: str | None = Field(default=None, min_length=1, max_length=160)
    coordinates: Coordinates | None = None
    source_ref: str | None = Field(default=None, min_length=1, max_length=500)
    is_synthetic: bool | None = None
    recording_availability: Availability | None = None
    retention_information: str | None = Field(default=None, max_length=1000)
    operational_from: datetime | None = None
    operational_to: datetime | None = None
    verified_orientation: dict[str, Any] | None = None

    @field_validator("operational_from", "operational_to")
    @classmethod
    def operational_dates_are_aware(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("Operational dates must include timezone offsets")
        return value


class Camera(CameraCreate):
    id: str
    investigation_id: str
    created_at: datetime
    updated_at: datetime


class ObservationInput(ApiModel):
    event_id: str = Field(min_length=1, max_length=160)
    location_id: str = Field(min_length=1, max_length=160)
    observed_at: datetime
    earliest_at: datetime | None = None
    latest_at: datetime | None = None
    time_precision: str
    association_kind: str = Field(pattern="^(DOCUMENTED_SIGHTING|ANALYST_ASSUMPTION)$")
    analyst_assumption_note: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def bounded_time(self) -> "ObservationInput":
        if self.observed_at.tzinfo is None:
            raise ValueError("Observation timestamps must include timezone offsets")
        if self.time_precision != "EXACT":
            if self.earliest_at is None or self.latest_at is None:
                raise ValueError("Approximate observations require explicit earliestAt and latestAt bounds")
            if self.earliest_at.tzinfo is None or self.latest_at.tzinfo is None or self.earliest_at > self.latest_at:
                raise ValueError("Approximate time bounds must be timezone-aware and ordered")
            if not self.earliest_at <= self.observed_at <= self.latest_at:
                raise ValueError("Observed time must fall within the supplied bounds")
        if self.association_kind == "ANALYST_ASSUMPTION" and not (self.analyst_assumption_note or "").strip():
            raise ValueError("Analyst assumptions require a note")
        return self


class ReconstructionRequest(ApiModel):
    entity_id: str = Field(min_length=1, max_length=160)
    start_observation: ObservationInput
    end_observation: ObservationInput
    travel_mode: str = Field(min_length=1, max_length=80)
    speed_kmh: float = Field(gt=0, le=400)
    selected_time: datetime | None = None


class CandidateResult(ApiModel):
    camera: Camera
    included: bool
    reason: str
    distance_from_start_km: float
    distance_to_end_km: float
    earliest_arrival: datetime | None = None
    latest_departure: datetime | None = None
    operational_status: str
    recording_availability: Availability


class ReconstructionPreview(ApiModel):
    investigation_id: str
    algorithm_version: str
    model_label: str
    is_envelope: bool
    feasible: bool
    reason: str
    start_coordinates: Coordinates
    end_coordinates: Coordinates
    start_time: datetime
    end_time: datetime
    selected_time: datetime
    forward_radius_km: float
    backward_radius_km: float
    forward_region: list[list[float]]
    backward_region: list[list[float]]
    candidates: list[CandidateResult]
    excluded_cameras: list[CandidateResult]
    inputs: ReconstructionRequest


class SavedReconstruction(ReconstructionPreview):
    id: str
    investigator_user_id: str
    created_at: datetime
    reviews: list[dict[str, Any]] = Field(default_factory=list)


class ReviewUpdate(ApiModel):
    status: ReviewStatus
    notes: str = Field(default="", max_length=4000)
    evidence_id: str | None = None


class CameraReview(ApiModel):
    run_id: str
    camera_id: str
    investigation_id: str
    status: ReviewStatus
    notes: str
    evidence_id: str | None
    reviewed_by: str
    updated_at: datetime
