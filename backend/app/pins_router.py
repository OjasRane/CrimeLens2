from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response, status
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .api.dependencies import (
    get_runtime_settings,
    require_active_profile,
    require_investigation_access,
)
from .core.config import Settings
from .schemas.auth import AuthorizedProfile


PinCategory = Literal[
    "crime_scene",
    "evidence",
    "cctv",
    "suspect_sighting",
    "witness",
    "point_of_interest",
    "lead",
    "custom",
]


class PinCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    title: str = Field(min_length=1, max_length=120)
    category: PinCategory
    description: str | None = Field(default=None, max_length=2_000)
    occurred_at: datetime | None = Field(default=None, alias="occurredAt")
    linked_evidence_id: str | None = Field(
        default=None,
        alias="linkedEvidenceId",
        max_length=100,
    )
    linked_suspect_id: str | None = Field(
        default=None,
        alias="linkedSuspectId",
        max_length=100,
    )
    linked_timeline_event_id: str | None = Field(
        default=None,
        alias="linkedTimelineEventId",
        max_length=100,
    )

    @field_validator(
        "title",
        "description",
        "linked_evidence_id",
        "linked_suspect_id",
        "linked_timeline_event_id",
        mode="before",
    )
    @classmethod
    def clean_text(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        cleaned = value.strip()
        if any(ord(character) < 32 and character not in "\n\t" for character in cleaned):
            raise ValueError("Text contains unsupported control characters")
        return cleaned or None

    @field_validator("title")
    @classmethod
    def title_is_required(cls, value: str | None) -> str:
        if not value:
            raise ValueError("Pin title is required")
        return value


class PinUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=120)
    category: PinCategory | None = None
    description: str | None = Field(default=None, max_length=2_000)
    occurred_at: datetime | None = Field(default=None, alias="occurredAt")
    linked_evidence_id: str | None = Field(
        default=None,
        alias="linkedEvidenceId",
        max_length=100,
    )
    linked_suspect_id: str | None = Field(
        default=None,
        alias="linkedSuspectId",
        max_length=100,
    )
    linked_timeline_event_id: str | None = Field(
        default=None,
        alias="linkedTimelineEventId",
        max_length=100,
    )

    @field_validator(
        "title",
        "description",
        "linked_evidence_id",
        "linked_suspect_id",
        "linked_timeline_event_id",
        mode="before",
    )
    @classmethod
    def clean_text(cls, value: object) -> object:
        return PinCreate.clean_text(value)

    @model_validator(mode="after")
    def has_an_update(self) -> "PinUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one editable field is required")
        if "title" in self.model_fields_set and not self.title:
            raise ValueError("Pin title is required")
        if "category" in self.model_fields_set and self.category is None:
            raise ValueError("Pin category is required")
        return self


class InvestigationPin(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: UUID
    investigation_id: str = Field(alias="investigationId")
    latitude: float
    longitude: float
    title: str
    category: PinCategory
    description: str | None = None
    occurred_at: datetime | None = Field(default=None, alias="occurredAt")
    linked_evidence_id: str | None = Field(default=None, alias="linkedEvidenceId")
    linked_suspect_id: str | None = Field(default=None, alias="linkedSuspectId")
    linked_timeline_event_id: str | None = Field(
        default=None,
        alias="linkedTimelineEventId",
    )
    created_by: UUID = Field(alias="createdBy")
    created_by_name: str = Field(alias="createdByName")
    created_by_agent_id: str = Field(alias="createdByAgentId")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    source: Literal["user"] = "user"
    can_edit: bool = Field(alias="canEdit")
    can_delete: bool = Field(alias="canDelete")


CASE_LINK_CATALOG: dict[str, dict[str, set[str]]] = {
    "demo": {
        "evidence": {"ev-ticket", "ev-print"},
        "suspect": {"sus-ada", "sus-marlowe", "sus-vale"},
        "timeline": {f"TL-{index:03d}" for index in range(1, 19)},
    },
    "mumbai-2611": {
        "evidence": {"evidence-judgment"},
        "suspect": {
            "attacker-kasab",
            "attacker-ismail",
            "attacker-nazir",
            "attacker-shoaib",
            "attacker-bada",
            "attacker-javed",
            "attacker-imran",
            "attacker-nasir",
            "attacker-fahadullah",
            "attacker-chhota",
            "planner-headley",
        },
        "timeline": {f"MUM-TL-{index:03d}" for index in range(1, 16)},
    },
}

READ_ONLY_ROLES = {"viewer", "read-only", "read_only", "readonly"}
ADMIN_ROLES = {"admin", "case-admin", "case_admin", "supervisor"}

PIN_SELECT = """
    SELECT
        pin.id,
        pin.investigation_id,
        pin.latitude,
        pin.longitude,
        pin.title,
        pin.category,
        pin.description,
        pin.occurred_at,
        pin.linked_evidence_id,
        pin.linked_suspect_id,
        pin.linked_timeline_event_id,
        pin.created_by,
        profile.display_name AS created_by_name,
        profile.agent_id AS created_by_agent_id,
        pin.created_at,
        pin.updated_at
    FROM public.investigation_pins AS pin
    JOIN public.profiles AS profile ON profile.user_id = pin.created_by
"""


def _database_url(settings: Settings) -> str:
    database_url = settings.database_url
    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Investigation pin database is not configured",
        )
    return database_url


def _normalized_role(profile: AuthorizedProfile) -> str:
    return profile.role.strip().lower()


def _can_write(profile: AuthorizedProfile) -> bool:
    return profile.active and _normalized_role(profile) not in READ_ONLY_ROLES


def _is_case_admin(profile: AuthorizedProfile) -> bool:
    return _normalized_role(profile) in ADMIN_ROLES


def _require_write_access(profile: AuthorizedProfile) -> None:
    if not _can_write(profile):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "INVESTIGATOR_WRITE_ACCESS_REQUIRED",
                "message": "Investigator write access is required.",
            },
        )


def _validate_links(
    investigation_id: str,
    linked_evidence_id: str | None,
    linked_suspect_id: str | None,
    linked_timeline_event_id: str | None,
) -> None:
    catalog = CASE_LINK_CATALOG[investigation_id]
    candidates = (
        ("Linked evidence", linked_evidence_id, "evidence"),
        ("Linked suspect", linked_suspect_id, "suspect"),
        ("Linked timeline event", linked_timeline_event_id, "timeline"),
    )
    for label, entity_id, entity_type in candidates:
        if entity_id and entity_id not in catalog[entity_type]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "code": "CROSS_INVESTIGATION_LINK",
                    "message": f"{label} does not belong to this investigation.",
                },
            )


def _pin_from_row(
    row: dict[str, object],
    profile: AuthorizedProfile,
) -> InvestigationPin:
    is_owner = str(row["created_by"]) == str(profile.user_id)
    return InvestigationPin.model_validate(
        {
            **row,
            "can_edit": is_owner or _is_case_admin(profile),
            "can_delete": is_owner or _is_case_admin(profile),
        },
    )


def _fetch_pin(
    cursor: psycopg.Cursor,
    investigation_id: str,
    pin_id: UUID,
    profile: AuthorizedProfile,
) -> InvestigationPin | None:
    cursor.execute(
        f"{PIN_SELECT} WHERE pin.investigation_id = %s AND pin.id = %s",
        (investigation_id, pin_id),
    )
    row = cursor.fetchone()
    return _pin_from_row(row, profile) if row else None


def _record_event(
    cursor: psycopg.Cursor,
    pin: InvestigationPin,
    actor_id: str,
    action: Literal["PIN_CREATED", "PIN_UPDATED", "PIN_DELETED"],
) -> None:
    cursor.execute(
        """
        INSERT INTO public.investigation_pin_events (
            pin_id, case_id, investigation_id, actor_id, action, snapshot
        ) VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (
            pin.id,
            pin.investigation_id,
            pin.investigation_id,
            actor_id,
            action,
            Jsonb(pin.model_dump(mode="json", by_alias=True)),
        ),
    )


def build_pins_router() -> APIRouter:
    router = APIRouter(
        prefix="/api/v1/investigations/{investigation_id}/pins",
        tags=["investigation-pins"],
    )

    @router.get("", response_model=list[InvestigationPin])
    def list_investigation_pins(
        investigation_id: str,
        _investigation: dict = Depends(require_investigation_access),
        profile: AuthorizedProfile = Depends(require_active_profile),
        settings: Settings = Depends(get_runtime_settings),
    ) -> list[InvestigationPin]:
        try:
            with psycopg.connect(_database_url(settings), row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        f"{PIN_SELECT} WHERE pin.investigation_id = %s ORDER BY pin.created_at ASC",
                        (investigation_id,),
                    )
                    return [_pin_from_row(row, profile) for row in cursor.fetchall()]
        except psycopg.Error as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "PINS_UNAVAILABLE", "message": "Investigation pins could not be loaded."},
            ) from error

    @router.post(
        "",
        response_model=InvestigationPin,
        status_code=status.HTTP_201_CREATED,
    )
    def create_investigation_pin(
        investigation_id: str,
        payload: PinCreate,
        _investigation: dict = Depends(require_investigation_access),
        profile: AuthorizedProfile = Depends(require_active_profile),
        settings: Settings = Depends(get_runtime_settings),
    ) -> InvestigationPin:
        _require_write_access(profile)
        _validate_links(
            investigation_id,
            payload.linked_evidence_id,
            payload.linked_suspect_id,
            payload.linked_timeline_event_id,
        )

        try:
            with psycopg.connect(_database_url(settings), row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO public.investigation_pins (
                            case_id,
                            investigation_id,
                            latitude,
                            longitude,
                            title,
                            category,
                            description,
                            occurred_at,
                            linked_evidence_id,
                            linked_suspect_id,
                            linked_timeline_event_id,
                            created_by
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            investigation_id,
                            investigation_id,
                            payload.latitude,
                            payload.longitude,
                            payload.title,
                            payload.category,
                            payload.description,
                            payload.occurred_at,
                            payload.linked_evidence_id,
                            payload.linked_suspect_id,
                            payload.linked_timeline_event_id,
                            profile.user_id,
                        ),
                    )
                    created = cursor.fetchone()
                    if not created:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Investigation pin could not be created",
                        )
                    pin = _fetch_pin(cursor, investigation_id, created["id"], profile)
                    if pin is None:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Investigation pin could not be created",
                        )
                    _record_event(cursor, pin, profile.user_id, "PIN_CREATED")
                    return pin
        except psycopg.Error as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Investigation pin could not be saved",
            ) from error

    @router.patch("/{pin_id}", response_model=InvestigationPin)
    def update_investigation_pin(
        investigation_id: str,
        pin_id: UUID,
        payload: PinUpdate,
        _investigation: dict = Depends(require_investigation_access),
        profile: AuthorizedProfile = Depends(require_active_profile),
        settings: Settings = Depends(get_runtime_settings),
    ) -> InvestigationPin:
        _require_write_access(profile)

        try:
            with psycopg.connect(_database_url(settings), row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    existing = _fetch_pin(cursor, investigation_id, pin_id, profile)
                    if existing is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Investigation pin not found",
                        )
                    if not existing.can_edit:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only the pin owner or a case admin can edit this pin",
                        )

                    updates = payload.model_dump(exclude_unset=True)
                    _validate_links(
                        investigation_id,
                        updates.get("linked_evidence_id", existing.linked_evidence_id),
                        updates.get("linked_suspect_id", existing.linked_suspect_id),
                        updates.get(
                            "linked_timeline_event_id",
                            existing.linked_timeline_event_id,
                        ),
                    )
                    columns = {
                        "title": "title",
                        "category": "category",
                        "description": "description",
                        "occurred_at": "occurred_at",
                        "linked_evidence_id": "linked_evidence_id",
                        "linked_suspect_id": "linked_suspect_id",
                        "linked_timeline_event_id": "linked_timeline_event_id",
                    }
                    assignments = [f"{columns[field]} = %s" for field in updates]
                    values = [updates[field] for field in updates]
                    assignments.append("updated_at = NOW()")
                    cursor.execute(
                        f"""
                        UPDATE public.investigation_pins
                        SET {", ".join(assignments)}
                        WHERE investigation_id = %s AND id = %s
                        """,
                        (*values, investigation_id, pin_id),
                    )
                    pin = _fetch_pin(cursor, investigation_id, pin_id, profile)
                    if pin is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Investigation pin not found",
                        )
                    _record_event(cursor, pin, profile.user_id, "PIN_UPDATED")
                    return pin
        except psycopg.Error as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Investigation pin could not be updated",
            ) from error

    @router.delete("/{pin_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_investigation_pin(
        investigation_id: str,
        pin_id: UUID,
        _investigation: dict = Depends(require_investigation_access),
        profile: AuthorizedProfile = Depends(require_active_profile),
        settings: Settings = Depends(get_runtime_settings),
    ) -> Response:
        _require_write_access(profile)

        try:
            with psycopg.connect(_database_url(settings), row_factory=dict_row) as connection:
                with connection.cursor() as cursor:
                    existing = _fetch_pin(cursor, investigation_id, pin_id, profile)
                    if existing is None:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="Investigation pin not found",
                        )
                    if not existing.can_delete:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only the pin owner or a case admin can delete this pin",
                        )
                    _record_event(cursor, existing, profile.user_id, "PIN_DELETED")
                    cursor.execute(
                        "DELETE FROM public.investigation_pins WHERE investigation_id = %s AND id = %s",
                        (investigation_id, pin_id),
                    )
                    return Response(status_code=status.HTTP_204_NO_CONTENT)
        except psycopg.Error as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Investigation pin could not be deleted",
            ) from error

    return router
