from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from .api.dependencies import get_evidence_repository, get_repository, require_active_profile, require_investigation_access
from .core.permissions import Role, normalize_role
from .schemas.auth import AuthorizedProfile
from .schemas.gap_reconstruction import Camera, CameraCreate, CameraReview, CameraUpdate, CandidateResult, Coordinates, ReconstructionPreview, ReconstructionRequest, ReviewUpdate, SavedReconstruction
from .services.evidence_repository import EvidenceRepository
from .services.gap_repository import GapRepository
from .services.gap_spatial import GeoPoint, assess_camera, geodesic_circle, region_at, validate_inputs
from .services.repository import InvestigationRepository


ALGORITHM_VERSION = "gap-reconstruction-geodesic-v1"
MODEL_LABEL = "Straight-line geodesic reachability; not road-network routing or proof of travel"
router = APIRouter(prefix="/api/v1/investigations/{investigation_id}", tags=["gap-reconstruction"])


def get_gap_repository(request: Request) -> GapRepository:
    return request.app.state.gap_repository


def _require_write(profile: AuthorizedProfile) -> None:
    if profile.role.strip().lower() in {"viewer", "read_only", "read-only"} or normalize_role(profile.role) not in {Role.INVESTIGATOR, Role.ANALYST, Role.SUPERVISOR, Role.ADMIN}:
        raise HTTPException(status_code=403, detail={"code":"WRITE_PERMISSION_REQUIRED","message":"Your profile cannot modify investigation analysis records."})


def _references(repository: InvestigationRepository, investigation_id: str, payload: ReconstructionRequest) -> tuple[dict, dict, dict, dict]:
    if repository.entity_details(investigation_id, payload.entity_id) is None:
        raise HTTPException(status_code=422, detail={"code":"ENTITY_NOT_IN_INVESTIGATION","message":"The selected entity does not belong to this investigation."})
    timeline = repository.get_timeline(investigation_id)["events"]
    events = {item["id"]: item for item in timeline}
    locations = {item["id"]: item for item in repository.get_map(investigation_id)["locations"]}
    resolved = []
    for observation in (payload.start_observation, payload.end_observation):
        event = events.get(observation.event_id)
        location = locations.get(observation.location_id)
        if event is None or location is None:
            raise HTTPException(status_code=422, detail={"code":"CROSS_INVESTIGATION_REFERENCE","message":"Each observation event and location must belong to this investigation."})
        coordinates = location.get("coordinates")
        if not coordinates:
            raise HTTPException(status_code=422, detail={"code":"OBSERVATION_LOCATION_MISSING","message":"An observation location has no verified coordinates; supply a verified association before analysis."})
        if observation.association_kind == "DOCUMENTED_SIGHTING" and (payload.entity_id not in event.get("linkedEntityIds", []) or observation.location_id not in event.get("linkedLocationIds", [])):
            raise HTTPException(status_code=422, detail={"code":"SIGHTING_NOT_DOCUMENTED","message":"A mention is not a sighting. Choose an explicitly linked event-location record or label the association as an analyst assumption."})
        resolved.append((event, location))
    return resolved[0][0], resolved[0][1], resolved[1][0], resolved[1][1]


def _preview(investigation_id: str, payload: ReconstructionRequest, repository: InvestigationRepository, gap_repository: GapRepository) -> ReconstructionPreview:
    _, start_location, _, end_location = _references(repository, investigation_id, payload)
    start_bounds = payload.start_observation
    end_bounds = payload.end_observation
    # Envelope uses the widest defensible interval: earliest start to latest end.
    start_time = start_bounds.earliest_at or start_bounds.observed_at
    end_time = end_bounds.latest_at or end_bounds.observed_at
    start = GeoPoint(latitude=start_location["coordinates"][1], longitude=start_location["coordinates"][0])
    end = GeoPoint(latitude=end_location["coordinates"][1], longitude=end_location["coordinates"][0])
    try:
        validate_inputs(start, end, start_time, end_time, payload.speed_kmh)
        selected_time = payload.selected_time or start_time + (end_time - start_time) / 2
        region = region_at(start, end, start_time, end_time, payload.speed_kmh, selected_time)
    except ValueError as error:
        raise HTTPException(status_code=422, detail={"code":"INVALID_RECONSTRUCTION_INPUT","message":str(error)}) from error

    candidates=[]; excluded=[]
    for raw in gap_repository.list_cameras(investigation_id):
        camera = Camera.model_validate(raw)
        operational = "UNKNOWN"
        period_start = payload.start_observation.earliest_at or payload.start_observation.observed_at
        period_end = payload.end_observation.latest_at or payload.end_observation.observed_at
        if camera.operational_from or camera.operational_to:
            operational = "OPERATIONAL"
            if (camera.operational_from and period_end < camera.operational_from) or (camera.operational_to and period_start > camera.operational_to):
                operational = "NON_OPERATIONAL"
        result = assess_camera(start, end, GeoPoint(camera.coordinates.latitude, camera.coordinates.longitude), start_time, end_time, payload.speed_kmh)
        included = result.included and operational != "NON_OPERATIONAL"
        item = CandidateResult(camera=camera, included=included, reason=("Camera was known to be non-operational during the analysis interval." if operational == "NON_OPERATIONAL" else result.reason), distance_from_start_km=result.distance_from_start_km, distance_to_end_km=result.distance_to_end_km, earliest_arrival=result.earliest_arrival if included else None, latest_departure=result.latest_departure if included else None, operational_status=operational, recording_availability=camera.recording_availability)
        (candidates if included else excluded).append(item)

    return ReconstructionPreview(
        investigation_id=investigation_id, algorithm_version=ALGORITHM_VERSION, model_label=MODEL_LABEL,
        is_envelope=start_bounds.time_precision != "EXACT" or end_bounds.time_precision != "EXACT",
        feasible=region.feasible, reason=region.reason,
        start_coordinates=Coordinates(latitude=start.latitude, longitude=start.longitude),
        end_coordinates=Coordinates(latitude=end.latitude, longitude=end.longitude),
        start_time=start_time, end_time=end_time, selected_time=region.at,
        forward_radius_km=region.forward_radius_km, backward_radius_km=region.backward_radius_km,
        forward_region=geodesic_circle(start, region.forward_radius_km), backward_region=geodesic_circle(end, region.backward_radius_km),
        candidates=candidates, excluded_cameras=excluded, inputs=payload,
    )


@router.get("/cameras", response_model=list[Camera])
def list_cameras(_investigation: Annotated[dict, Depends(require_investigation_access)], gap_repository: Annotated[GapRepository, Depends(get_gap_repository)]) -> list[Camera]:
    return [Camera.model_validate(item) for item in gap_repository.list_cameras(_investigation["id"])]


@router.post("/cameras", response_model=Camera, status_code=status.HTTP_201_CREATED)
def create_camera(payload: CameraCreate, _investigation: Annotated[dict, Depends(require_investigation_access)], profile: Annotated[AuthorizedProfile, Depends(require_active_profile)], repository: Annotated[InvestigationRepository, Depends(get_repository)], gap_repository: Annotated[GapRepository, Depends(get_gap_repository)]) -> Camera:
    _require_write(profile)
    camera=Camera.model_validate(gap_repository.create_camera(_investigation["id"], profile.user_id, payload.model_dump(mode="json", by_alias=True)))
    repository.record_audit(profile=profile,action="CAMERA_CREATED",resource_type="gap_camera",resource_id=camera.id,investigation_id=_investigation["id"],metadata={"synthetic":camera.is_synthetic})
    return camera


@router.patch("/cameras/{camera_id}", response_model=Camera)
def update_camera(camera_id: UUID, payload: CameraUpdate, _investigation: Annotated[dict, Depends(require_investigation_access)], profile: Annotated[AuthorizedProfile, Depends(require_active_profile)], repository: Annotated[InvestigationRepository, Depends(get_repository)], gap_repository: Annotated[GapRepository, Depends(get_gap_repository)]) -> Camera:
    _require_write(profile)
    existing = next((item for item in gap_repository.list_cameras(_investigation["id"]) if item["id"] == str(camera_id)), None)
    if not existing: raise HTTPException(status_code=404,detail={"code":"CAMERA_NOT_FOUND","message":"Camera not found in this investigation."})
    changes = payload.model_dump(mode="json",by_alias=True,exclude_unset=True)
    try:
        editable = {key: existing.get(key) for key in ("label", "coordinates", "sourceRef", "isSynthetic", "operationalFrom", "operationalTo", "recordingAvailability", "retentionInformation", "verifiedOrientation")}
        CameraCreate.model_validate({**editable, **changes})
    except ValueError as error:
        raise HTTPException(status_code=422,detail={"code":"INVALID_CAMERA_UPDATE","message":"Camera operational dates must remain ordered."}) from error
    updated=gap_repository.update_camera(_investigation["id"],camera_id,changes)
    if not updated: raise HTTPException(status_code=404,detail={"code":"CAMERA_NOT_FOUND","message":"Camera not found in this investigation."})
    camera = Camera.model_validate(updated)
    repository.record_audit(profile=profile,action="CAMERA_UPDATED",resource_type="gap_camera",resource_id=camera.id,investigation_id=_investigation["id"],metadata={"fields": sorted(changes)})
    return camera


@router.post("/gap-reconstructions/preview", response_model=ReconstructionPreview)
def preview(payload: ReconstructionRequest, _investigation: Annotated[dict, Depends(require_investigation_access)], repository: Annotated[InvestigationRepository, Depends(get_repository)], gap_repository: Annotated[GapRepository, Depends(get_gap_repository)]) -> ReconstructionPreview:
    return _preview(_investigation["id"],payload,repository,gap_repository)


@router.get("/gap-reconstructions", response_model=list[SavedReconstruction])
def list_runs(_investigation: Annotated[dict, Depends(require_investigation_access)], gap_repository: Annotated[GapRepository, Depends(get_gap_repository)]) -> list[SavedReconstruction]:
    return [SavedReconstruction.model_validate(item) for item in gap_repository.list_runs(_investigation["id"])]


@router.post("/gap-reconstructions", response_model=SavedReconstruction, status_code=status.HTTP_201_CREATED)
def save_run(payload: ReconstructionRequest, _investigation: Annotated[dict, Depends(require_investigation_access)], profile: Annotated[AuthorizedProfile, Depends(require_active_profile)], repository: Annotated[InvestigationRepository, Depends(get_repository)], gap_repository: Annotated[GapRepository, Depends(get_gap_repository)]) -> SavedReconstruction:
    _require_write(profile)
    calculated=_preview(_investigation["id"],payload,repository,gap_repository)
    saved=SavedReconstruction.model_validate(gap_repository.save_run(_investigation["id"],profile.user_id,calculated.model_dump(mode="json",by_alias=True)))
    repository.record_audit(profile=profile,action="GAP_RECONSTRUCTION_SAVED",resource_type="gap_reconstruction",resource_id=saved.id,investigation_id=_investigation["id"],metadata={"algorithmVersion":ALGORITHM_VERSION,"candidateCount":len(saved.candidates)})
    return saved


@router.get("/gap-reconstructions/{run_id}", response_model=SavedReconstruction)
def get_run(run_id: UUID, _investigation: Annotated[dict, Depends(require_investigation_access)], gap_repository: Annotated[GapRepository, Depends(get_gap_repository)]) -> SavedReconstruction:
    found=gap_repository.get_run(_investigation["id"],run_id)
    if not found: raise HTTPException(status_code=404,detail={"code":"RECONSTRUCTION_NOT_FOUND","message":"Saved reconstruction not found in this investigation."})
    return SavedReconstruction.model_validate(found)


@router.patch("/gap-reconstructions/{run_id}/cameras/{camera_id}/review", response_model=CameraReview)
def update_review(run_id: UUID, camera_id: UUID, payload: ReviewUpdate, _investigation: Annotated[dict, Depends(require_investigation_access)], profile: Annotated[AuthorizedProfile, Depends(require_active_profile)], repository: Annotated[InvestigationRepository, Depends(get_repository)], evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)], gap_repository: Annotated[GapRepository, Depends(get_gap_repository)]) -> CameraReview:
    _require_write(profile)
    if payload.evidence_id:
        try: evidence=evidence_repository.get_evidence(UUID(payload.evidence_id))
        except ValueError as error: raise HTTPException(status_code=422,detail={"code":"INVALID_EVIDENCE_REFERENCE","message":"Evidence ID is invalid."}) from error
        if not evidence or evidence["investigation_id"] != _investigation["id"]: raise HTTPException(status_code=422,detail={"code":"CROSS_INVESTIGATION_EVIDENCE","message":"Linked evidence must belong to this investigation."})
    updated=gap_repository.update_review(_investigation["id"],run_id,camera_id,profile.user_id,payload.model_dump(mode="json",by_alias=True))
    if not updated: raise HTTPException(status_code=404,detail={"code":"REVIEW_TARGET_NOT_FOUND","message":"The saved run or candidate camera was not found."})
    review = CameraReview.model_validate(updated)
    repository.record_audit(profile=profile,action="CAMERA_REVIEW_UPDATED",resource_type="gap_camera_review",resource_id=f"{run_id}:{camera_id}",investigation_id=_investigation["id"],metadata={"status":review.status,"evidenceLinked":bool(review.evidence_id)})
    return review
