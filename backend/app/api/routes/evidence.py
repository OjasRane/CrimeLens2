from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status

from ..dependencies import get_evidence_repository, get_repository, get_runtime_settings, require_active_profile, require_investigation_access
from ...core.config import Settings
from ...core.permissions import can_access_investigation
from ...schemas.auth import AuthorizedProfile
from ...schemas.evidence import (
    ActivityEvent,
    CandidateReviewRequest,
    CommitResponse,
    EvidenceExtractionResponse,
    EvidenceItemResponse,
    ExtractionCandidateResponse,
    InvestigationStatusResponse,
    ReportDraftResponse,
    ReportRequest,
    SearchResult,
)
from ...services.evidence_extraction import configured_evidence_provider, extract_content
from ...services.evidence_repository import EvidenceRepository
from ...services.repository import InvestigationRepository


router = APIRouter(prefix="/api/v1", tags=["evidence ingestion"])


def _safe_name(filename: str) -> str:
    name = Path(filename).name
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:180] or "evidence.bin"


def _content_matches_mime(data: bytes, mime_type: str) -> bool:
    if mime_type == "application/pdf":
        return data.startswith(b"%PDF-")
    if mime_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if mime_type in {"text/plain", "text/csv", "application/csv", "application/json"}:
        if b"\x00" in data[:8_192]:
            return False
        try:
            data[:8_192].decode("utf-8-sig")
            return True
        except UnicodeDecodeError:
            return False
    return False


def _ensure_evidence_access(evidence_id: UUID, profile: AuthorizedProfile, repository: InvestigationRepository, evidence_repository: EvidenceRepository) -> dict[str, Any]:
    evidence = evidence_repository.get_evidence(evidence_id)
    if not evidence:
        raise HTTPException(status_code=404, detail={"code": "EVIDENCE_NOT_FOUND", "message": "Evidence item not found."})
    investigation = repository.get_investigation(evidence["investigation_id"])
    if not investigation or not can_access_investigation(
        active=profile.active,
        user_clearance=profile.clearance_level,
        classification=investigation["classification"],
        is_demo=investigation["isDemo"],
        has_explicit_access=repository.has_explicit_access(evidence["investigation_id"], profile.user_id),
    ):
        raise HTTPException(status_code=403, detail={"code": "INVESTIGATION_ACCESS_DENIED", "message": "Your role or clearance does not permit this evidence."})
    return evidence


def _process_evidence(evidence_id: UUID, profile: AuthorizedProfile, settings: Settings, repository: InvestigationRepository, evidence_repository: EvidenceRepository) -> None:
    evidence = evidence_repository.get_evidence(evidence_id)
    if not evidence:
        return
    try:
        evidence_repository.set_processing(evidence_id, "EXTRACTING")
        data = Path(evidence["storage_reference"]).read_bytes()
        derived = extract_content(data, evidence["mime_type"], evidence["original_filename"])
        repository.record_audit(profile=profile, action="CONTENT_EXTRACTED", resource_type="evidence", resource_id=str(evidence_id), investigation_id=evidence["investigation_id"], metadata={"locatorKind": derived.locator_kind, "characters": len(derived.text)})
        evidence_repository.set_processing(evidence_id, "AI_ANALYZING")
        provider = configured_evidence_provider(settings)
        network = repository.get_network(evidence["investigation_id"])
        timeline = repository.get_timeline(evidence["investigation_id"])
        structured = provider.extract(derived.text, {"entities": network.get("nodes", []), "events": timeline.get("events", [])})
        evidence_repository.save_extraction(evidence_id, structured.model_dump(by_alias=True), provider.provider_name, provider.model_identifier, derived.text, derived.locator_kind)
        repository.record_audit(profile=profile, action="AI_EXTRACTION_COMPLETED", resource_type="evidence", resource_id=str(evidence_id), investigation_id=evidence["investigation_id"], metadata={"provider": provider.provider_name})
    except Exception as error:
        evidence_repository.set_processing(evidence_id, "FAILED", str(error)[:300])
        try:
            repository.record_audit(profile=profile, action="CONTENT_EXTRACTION_FAILED", resource_type="evidence", resource_id=str(evidence_id), investigation_id=evidence["investigation_id"], success=False, metadata={"failureReason": str(error)[:160]})
        except Exception:
            pass


@router.post("/investigations/{investigation_id}/evidence", response_model=EvidenceItemResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_evidence(
    background_tasks: BackgroundTasks,
    investigation: Annotated[dict, Depends(require_investigation_access)],
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
    settings: Annotated[Settings, Depends(get_runtime_settings)],
    source_type: Annotated[str, Form(min_length=1, max_length=80)],
    description: Annotated[str, Form(max_length=2_000)] = "",
    file: UploadFile = File(...),
) -> EvidenceItemResponse:
    filename = _safe_name(file.filename or "evidence.bin")
    mime_type = (file.content_type or "application/octet-stream").lower().split(";", 1)[0]
    if mime_type not in settings.evidence_mime_types:
        raise HTTPException(status_code=415, detail={"code": "UNSUPPORTED_EVIDENCE_TYPE", "message": "Supported evidence types are PDF, TXT, CSV, JSON, JPEG, and PNG."})
    limit = settings.max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status_code=413, detail={"code": "EVIDENCE_TOO_LARGE", "message": f"Evidence files may not exceed {settings.max_upload_mb} MB."})
    if not data:
        raise HTTPException(status_code=422, detail={"code": "EMPTY_EVIDENCE", "message": "The selected evidence file is empty."})
    if not _content_matches_mime(data, mime_type):
        raise HTTPException(status_code=415, detail={"code": "EVIDENCE_CONTENT_MISMATCH", "message": "The file content does not match its declared evidence type."})
    evidence_id = uuid4()
    storage_root = Path(settings.evidence_storage_dir)
    storage_root.mkdir(parents=True, exist_ok=True)
    storage_path = storage_root / f"{evidence_id}-{filename}"
    storage_path.write_bytes(data)
    try:
        item = evidence_repository.create_evidence(investigation["id"], profile, {
            "id": evidence_id,
            "source_type": source_type.upper().replace(" ", "_"), "description": description.strip(),
            "original_filename": filename, "storage_reference": str(storage_path.resolve()),
            "mime_type": mime_type, "size_bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        })
    except Exception:
        storage_path.unlink(missing_ok=True)
        raise
    background_tasks.add_task(_process_evidence, item["id"], profile, settings, repository, evidence_repository)
    return EvidenceItemResponse.model_validate(item)


@router.get("/investigations/{investigation_id}/evidence", response_model=list[EvidenceItemResponse])
def list_evidence(
    investigation: Annotated[dict, Depends(require_investigation_access)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
) -> list[EvidenceItemResponse]:
    return [EvidenceItemResponse.model_validate(item) for item in evidence_repository.list_evidence(investigation["id"])]


@router.get("/evidence/{evidence_id}", response_model=EvidenceItemResponse)
def get_evidence(
    evidence_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
) -> EvidenceItemResponse:
    return EvidenceItemResponse.model_validate(_ensure_evidence_access(evidence_id, profile, repository, evidence_repository))


@router.post("/evidence/{evidence_id}/extract", response_model=dict, status_code=202)
def retry_extraction(
    evidence_id: UUID,
    background_tasks: BackgroundTasks,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
    settings: Annotated[Settings, Depends(get_runtime_settings)],
) -> dict[str, str]:
    _ensure_evidence_access(evidence_id, profile, repository, evidence_repository)
    evidence_repository.set_processing(evidence_id, "UPLOADED", None)
    background_tasks.add_task(_process_evidence, evidence_id, profile, settings, repository, evidence_repository)
    return {"jobId": str(evidence_id), "status": "UPLOADED"}


@router.get("/evidence/{evidence_id}/extraction", response_model=EvidenceExtractionResponse)
def get_extraction(
    evidence_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
) -> EvidenceExtractionResponse:
    _ensure_evidence_access(evidence_id, profile, repository, evidence_repository)
    extraction = evidence_repository.get_extraction(evidence_id)
    if not extraction:
        raise HTTPException(status_code=404, detail={"code": "EXTRACTION_NOT_READY", "message": "No completed extraction is available yet."})
    return EvidenceExtractionResponse.model_validate(extraction)


@router.patch("/evidence/{evidence_id}/candidates/{candidate_id}", response_model=ExtractionCandidateResponse)
def review_candidate(
    evidence_id: UUID,
    candidate_id: UUID,
    review: CandidateReviewRequest,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
) -> ExtractionCandidateResponse:
    _ensure_evidence_access(evidence_id, profile, repository, evidence_repository)
    try:
        candidate = evidence_repository.review_candidate(evidence_id, candidate_id, review.model_dump(), profile)
    except ValueError as error:
        raise HTTPException(status_code=409, detail={"code": "INVALID_REVIEW", "message": str(error)}) from error
    if not candidate:
        raise HTTPException(status_code=404, detail={"code": "CANDIDATE_NOT_FOUND", "message": "Extraction candidate not found."})
    return ExtractionCandidateResponse.model_validate(candidate)


@router.post("/evidence/{evidence_id}/commit", response_model=CommitResponse)
def commit_evidence(
    evidence_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
) -> CommitResponse:
    _ensure_evidence_access(evidence_id, profile, repository, evidence_repository)
    try:
        return CommitResponse.model_validate(evidence_repository.commit(evidence_id, profile))
    except ValueError as error:
        raise HTTPException(status_code=409, detail={"code": "COMMIT_BLOCKED", "message": str(error)}) from error


@router.get("/evidence/{evidence_id}/history", response_model=list[ActivityEvent])
def evidence_history(
    evidence_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
) -> list[ActivityEvent]:
    evidence = _ensure_evidence_access(evidence_id, profile, repository, evidence_repository)
    events = [item for item in repository.recent_audit(500, 0) if item.get("investigationId", item.get("investigation_id")) == evidence["investigation_id"] and (item.get("resourceId", item.get("resource_id")) == str(evidence_id) or item.get("metadata", {}).get("evidenceId") == str(evidence_id))]
    return [ActivityEvent.model_validate({"id": str(item["id"]), "event_type": item["action"], "resource_type": item.get("resourceType", item.get("resource_type")), "resource_id": item.get("resourceId", item.get("resource_id")), "agent_id": item.get("agentId", item.get("agent_id", profile.agent_id)), "created_at": item.get("createdAt", item.get("created_at")), "metadata": item.get("metadata", {})}) for item in events]


@router.get("/investigations/{investigation_id}/activity", response_model=list[ActivityEvent])
def investigation_activity(
    investigation: Annotated[dict, Depends(require_investigation_access)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> list[ActivityEvent]:
    events = [item for item in repository.recent_audit(500, 0) if item.get("investigationId", item.get("investigation_id")) == investigation["id"]][:limit]
    return [ActivityEvent.model_validate({"id": str(item["id"]), "event_type": item["action"], "resource_type": item.get("resourceType", item.get("resource_type")), "resource_id": item.get("resourceId", item.get("resource_id")), "agent_id": item.get("agentId", item.get("agent_id", "SYSTEM")), "created_at": item.get("createdAt", item.get("created_at")), "metadata": item.get("metadata", {})}) for item in events]


@router.get("/investigations/{investigation_id}/search", response_model=list[SearchResult])
def search_investigation(
    investigation: Annotated[dict, Depends(require_investigation_access)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
    q: Annotated[str, Query(min_length=1, max_length=120)],
) -> list[SearchResult]:
    term = q.casefold().strip()
    results: list[dict[str, str]] = []
    network, map_data, timeline = repository.get_network(investigation["id"]), repository.get_map(investigation["id"]), repository.get_timeline(investigation["id"])
    facts, _ = repository.get_facts(investigation["id"], limit=250)
    groups = [
        (network["nodes"], "ENTITY", "network", lambda item: item.get("label", ""), lambda item: item.get("subtitle", "")),
        (map_data["locations"], "LOCATION", "map", lambda item: item.get("title", ""), lambda item: item.get("description", "")),
        (timeline["events"], "TIMELINE", "timeline", lambda item: item.get("title", ""), lambda item: f"{item.get('date', '')} {item.get('time', '')}"),
        (facts, "FACT", "ledger", lambda item: item.get("text", ""), lambda item: item.get("sourceTitle", "")),
        (evidence_repository.list_evidence(investigation["id"]), "EVIDENCE", "evidence", lambda item: f"{item.get('display_id')} {item.get('original_filename')}", lambda item: item.get("description", "")),
    ]
    for items, result_type, workspace, title, detail in groups:
        for item in items:
            haystack = json.dumps(item, default=str).casefold()
            if term in haystack:
                results.append({"id": str(item["id"]), "result_type": result_type, "title": str(title(item)), "detail": str(detail(item)), "workspace": workspace})
    return [SearchResult.model_validate(item) for item in results[:50]]


@router.get("/investigations/{investigation_id}/status", response_model=InvestigationStatusResponse)
def investigation_status(
    investigation: Annotated[dict, Depends(require_investigation_access)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
) -> InvestigationStatusResponse:
    counts = repository.counts(investigation["id"])
    pending = sum(item["processing_status"] in {"PENDING_REVIEW", "PARTIALLY_REVIEWED"} for item in evidence_repository.list_evidence(investigation["id"]))
    facts, _ = repository.get_facts(investigation["id"], limit=250)
    network = repository.get_network(investigation["id"])
    unsourced = sum(not edge.get("sourceRef") for edge in network["edges"])
    readiness = []
    if pending: readiness.append({"type": "PENDING_EVIDENCE_REVIEW", "count": pending, "label": f"{pending} evidence extraction(s) require review"})
    if unsourced: readiness.append({"type": "UNSOURCED_RELATIONSHIP", "count": unsourced, "label": f"{unsourced} relationship(s) have no source"})
    open_conflicts = evidence_repository.count_open_conflicts(investigation["id"])
    if open_conflicts: readiness.append({"type": "POTENTIAL_CONFLICT", "count": open_conflicts, "label": f"{open_conflicts} potential conflict(s) require review"})
    return InvestigationStatusResponse(verified_entities=counts["entities"], supported_links=counts["relationships"] - unsourced, hypotheses=sum(fact.get("status") == "pending" for fact in facts), open_conflicts=open_conflicts, open_questions=0, unsourced_relationships=unsourced, pending_review=pending, readiness_items=readiness)


@router.post("/investigations/{investigation_id}/reports", response_model=ReportDraftResponse)
def generate_report(
    request: ReportRequest,
    investigation: Annotated[dict, Depends(require_investigation_access)],
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    evidence_repository: Annotated[EvidenceRepository, Depends(get_evidence_repository)],
) -> ReportDraftResponse:
    counts = repository.counts(investigation["id"])
    evidence = evidence_repository.list_evidence(investigation["id"])
    content = "\n\n".join([
        "AI-ASSISTED DRAFT — INVESTIGATOR REVIEW REQUIRED",
        f"1. INVESTIGATION OVERVIEW\n{investigation['name']} — {investigation['summary']}",
        f"2. VERIFIED / REVIEWED CASE DATA\n{counts['entities']} entities; {counts['relationships']} relationships; {counts['timelineEvents']} timeline events.",
        "3. KEY ENTITIES\nSee the reviewed Case Graph. No unreviewed extraction candidates are included.",
        "4. TIMELINE\nSee Timeline Analysis; approximate times retain their precision label.",
        "5. NETWORK RELATIONSHIPS\nOnly case relationships and explicitly committed reviewed extraction records are included.",
        f"6. EVIDENCE SOURCES\n{sum(item['processing_status'] == 'APPROVED' for item in evidence)} approved of {len(evidence)} ingested evidence items.",
        "7. ANALYST FINDINGS\nKept separate from source-backed facts.",
        "8. HYPOTHESES\nNo hypothesis has been promoted to verified data by this draft.",
        "9. UNRESOLVED QUESTIONS\nReview the investigation workspace question queue.",
        "10. POTENTIAL CONFLICTS\nReview flagged conflicts before relying on this draft.",
        "11. AI-ASSISTED OBSERVATIONS\nThis bounded pilot draft summarizes counts and labels; it does not determine investigative truth.",
    ])
    report = ReportDraftResponse(id=str(uuid4()), investigation_id=investigation["id"], status="AI_ASSISTED_DRAFT", title=f"{investigation['shortName']} // CASE BRIEF", content=content, created_at=datetime.now(timezone.utc))
    evidence_repository.save_report(report.model_dump(), request.include, profile)
    repository.record_audit(profile=profile, action="REPORT_GENERATED", resource_type="case_report_draft", resource_id=report.id, investigation_id=investigation["id"], metadata={"include": request.include})
    return report
