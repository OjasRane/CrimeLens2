from __future__ import annotations

import hashlib
import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from ..dependencies import (
    get_repository,
    require_active_profile,
    require_investigation_access,
)
from ...core.permissions import can_access_investigation
from ...schemas.auth import AuthorizedProfile
from ...schemas.investigations import (
    EntityDetailsResponse,
    InvestigationDetail,
    InvestigationFactsResponse,
    InvestigationMapResponse,
    InvestigationNetworkResponse,
    InvestigationOverview,
    InvestigationSummary,
    InvestigationTimelineResponse,
    LocationDetailsResponse,
)
from ...services.repository import InvestigationRepository


router = APIRouter(prefix="/api/v1/investigations", tags=["investigations"])


def _csv(value: str | None) -> list[str] | None:
    if not value:
        return None
    parsed = [item.strip() for item in value.split(",") if item.strip()]
    return parsed or None


def _cache(response: Response, payload, seconds: int) -> None:
    encoded = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":")).encode()
    response.headers["ETag"] = f'"{hashlib.sha256(encoded).hexdigest()}"'
    response.headers["Cache-Control"] = f"private, max-age={seconds}, must-revalidate"


def _audit(
    repository: InvestigationRepository,
    profile: AuthorizedProfile,
    action: str,
    resource_type: str,
    resource_id: str | None,
    investigation_id: str | None,
) -> None:
    try:
        repository.record_audit(
            profile=profile,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            investigation_id=investigation_id,
        )
    except Exception:
        # Read availability is not coupled to audit persistence availability.
        return


@router.get("", response_model=list[InvestigationSummary])
def list_investigations(
    response: Response,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[InvestigationSummary]:
    available = []
    for summary in repository.list_investigations():
        if can_access_investigation(
            active=profile.active,
            user_clearance=profile.clearance_level,
            classification=summary["classification"],
            is_demo=summary["isDemo"],
            has_explicit_access=repository.has_explicit_access(summary["id"], profile.user_id),
        ):
            available.append(InvestigationSummary.model_validate(summary))
    response.headers["X-Total-Count"] = str(len(available))
    response.headers["Cache-Control"] = "private, no-store"
    return available[offset : offset + limit]


@router.get("/{investigation_id}", response_model=InvestigationDetail)
def get_investigation(
    response: Response,
    investigation: Annotated[dict, Depends(require_investigation_access)],
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> InvestigationDetail:
    model = InvestigationDetail.model_validate(investigation)
    _cache(response, model.model_dump(mode="json", by_alias=True), 300)
    _audit(repository, profile, "INVESTIGATION_OPENED", "investigation", model.id, model.id)
    return model


@router.get("/{investigation_id}/overview", response_model=InvestigationOverview)
def get_overview(
    response: Response,
    investigation: Annotated[dict, Depends(require_investigation_access)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> InvestigationOverview:
    model = InvestigationOverview(
        metadata=InvestigationDetail.model_validate(investigation),
        counts=repository.counts(investigation["id"]),
    )
    _cache(response, model.model_dump(mode="json", by_alias=True), 300)
    return model


@router.get("/{investigation_id}/map", response_model=InvestigationMapResponse)
def get_map(
    response: Response,
    investigation: Annotated[dict, Depends(require_investigation_access)],
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    types: str | None = None,
    importance: str | None = None,
    bounds: str | None = None,
) -> InvestigationMapResponse:
    parsed_bounds = None
    if bounds:
        try:
            values = tuple(float(value) for value in bounds.split(","))
            if len(values) != 4:
                raise ValueError
            west, south, east, north = values
            if west > east or south > north or not (-180 <= west <= 180 and -180 <= east <= 180 and -90 <= south <= 90 and -90 <= north <= 90):
                raise ValueError
            parsed_bounds = values
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={"code": "INVALID_BOUNDS", "message": "Bounds must be west,south,east,north."},
            ) from error
    model = InvestigationMapResponse.model_validate(
        repository.get_map(
            investigation["id"],
            types=_csv(types),
            importance=_csv(importance),
            bounds=parsed_bounds,
        )
    )
    _cache(response, model.model_dump(mode="json", by_alias=True), 300)
    _audit(repository, profile, "MAP_VIEWED", "investigation_map", None, investigation["id"])
    return model


@router.get("/{investigation_id}/network", response_model=InvestigationNetworkResponse)
def get_network(
    response: Response,
    investigation: Annotated[dict, Depends(require_investigation_access)],
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    layers: str | None = None,
    entity_id: Annotated[str | None, Query(alias="entityId", max_length=120)] = None,
    hops: Annotated[int, Query(ge=0, le=4)] = 1,
) -> InvestigationNetworkResponse:
    model = InvestigationNetworkResponse.model_validate(
        repository.get_network(
            investigation["id"], layers=_csv(layers), entity_id=entity_id, hops=hops
        )
    )
    _cache(response, model.model_dump(mode="json", by_alias=True), 300)
    _audit(repository, profile, "NETWORK_VIEWED", "investigation_network", entity_id, investigation["id"])
    return model


@router.get("/{investigation_id}/timeline", response_model=InvestigationTimelineResponse)
def get_timeline(
    response: Response,
    investigation: Annotated[dict, Depends(require_investigation_access)],
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    date_from: Annotated[str | None, Query(alias="from", pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    date_to: Annotated[str | None, Query(alias="to", pattern=r"^\d{4}-\d{2}-\d{2}$")] = None,
    types: str | None = None,
    entity_id: Annotated[str | None, Query(alias="entityId", max_length=120)] = None,
    location_id: Annotated[str | None, Query(alias="locationId", max_length=120)] = None,
) -> InvestigationTimelineResponse:
    model = InvestigationTimelineResponse.model_validate(
        repository.get_timeline(
            investigation["id"],
            date_from=date_from,
            date_to=date_to,
            types=_csv(types),
            entity_id=entity_id,
            location_id=location_id,
        )
    )
    _cache(response, model.model_dump(mode="json", by_alias=True), 300)
    _audit(repository, profile, "TIMELINE_VIEWED", "investigation_timeline", None, investigation["id"])
    return model


@router.get("/{investigation_id}/facts", response_model=InvestigationFactsResponse)
def get_facts(
    response: Response,
    investigation: Annotated[dict, Depends(require_investigation_access)],
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    fact_type: Annotated[str | None, Query(alias="type", max_length=80)] = None,
    verification_status: Annotated[str | None, Query(alias="status", max_length=40)] = None,
    entity_id: Annotated[str | None, Query(alias="entityId", max_length=120)] = None,
    location_id: Annotated[str | None, Query(alias="locationId", max_length=120)] = None,
    event_id: Annotated[str | None, Query(alias="eventId", max_length=120)] = None,
    limit: Annotated[int, Query(ge=1, le=250)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> InvestigationFactsResponse:
    facts, total = repository.get_facts(
        investigation["id"],
        fact_type=fact_type,
        status=verification_status,
        entity_id=entity_id,
        location_id=location_id,
        event_id=event_id,
        limit=limit,
        offset=offset,
    )
    model = InvestigationFactsResponse(
        investigation_id=investigation["id"], facts=facts, total=total, limit=limit, offset=offset
    )
    _cache(response, model.model_dump(mode="json", by_alias=True), 300)
    _audit(repository, profile, "EVIDENCE_VIEWED", "evidence_facts", None, investigation["id"])
    return model


@router.get("/{investigation_id}/entities/{entity_id}", response_model=EntityDetailsResponse)
def get_entity_details(
    investigation: Annotated[dict, Depends(require_investigation_access)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    entity_id: str,
) -> EntityDetailsResponse:
    details = repository.entity_details(investigation["id"], entity_id)
    if details is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "ENTITY_NOT_FOUND", "message": "Entity not found in this investigation."},
        )
    return EntityDetailsResponse.model_validate(details)


@router.get("/{investigation_id}/locations/{location_id}", response_model=LocationDetailsResponse)
def get_location_details(
    investigation: Annotated[dict, Depends(require_investigation_access)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    location_id: str,
) -> LocationDetailsResponse:
    details = repository.location_details(investigation["id"], location_id)
    if details is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "LOCATION_NOT_FOUND", "message": "Location not found in this investigation."},
        )
    return LocationDetailsResponse.model_validate(details)
