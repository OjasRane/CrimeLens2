from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Path, Response, status

from ..dependencies import get_repository, get_runtime_settings, require_active_profile
from ...core.config import Settings
from ...core.permissions import can_access_investigation
from ...schemas.auth import AuthorizedProfile
from ...schemas.workspaces import (
    ConflictReview,
    GraphWorkspace,
    QuestionCreate,
    QuestionUpdate,
    SnapshotCreate,
    SuggestionReview,
    WorkspaceAnalysisResponse,
    WorkspaceConflict,
    WorkspaceCreate,
    WorkspacePathRequest,
    WorkspacePathResponse,
    WorkspaceQuestion,
    WorkspaceSave,
    WorkspaceSnapshot,
    WorkspaceSuggestion,
    WorkspaceSummary,
)
from ...services.repository import InvestigationRepository
from ...services.connection_suggestion_provider import configured_connection_provider
from ...services.workspace_intelligence import analyze_workspace, find_documented_path


router = APIRouter(prefix="/api/v1", tags=["graph-workspaces"])
logger = logging.getLogger("crimelens.workspace_intelligence")


def _require_case_access(repository: InvestigationRepository, profile: AuthorizedProfile, investigation_id: str) -> None:
    investigation = repository.get_investigation(investigation_id)
    if not investigation:
        raise HTTPException(status_code=404, detail={"code": "INVESTIGATION_NOT_FOUND", "message": "Investigation not found."})
    if not can_access_investigation(
        active=profile.active,
        user_clearance=profile.clearance_level,
        classification=investigation["classification"],
        is_demo=investigation["isDemo"],
        has_explicit_access=repository.has_explicit_access(investigation_id, profile.user_id),
    ):
        raise HTTPException(status_code=403, detail={"code": "INVESTIGATION_ACCESS_DENIED", "message": "Your role or clearance does not permit this investigation."})


def _audit(repository: InvestigationRepository, profile: AuthorizedProfile, action: str, workspace_id: UUID, investigation_id: str) -> None:
    repository.record_audit(profile=profile, action=action, resource_type="graph_workspace", resource_id=str(workspace_id), investigation_id=investigation_id)


def _workspace_or_404(repository: InvestigationRepository, profile: AuthorizedProfile, workspace_id: UUID) -> dict:
    workspace = repository.get_graph_workspace(workspace_id, profile.user_id)
    if not workspace:
        raise HTTPException(status_code=404, detail={"code": "WORKSPACE_NOT_FOUND", "message": "Workspace not found."})
    return workspace


def _save(repository: InvestigationRepository, profile: AuthorizedProfile, workspace: dict) -> dict:
    serialized = GraphWorkspace.model_validate(workspace).model_dump(mode="json")
    return repository.save_graph_workspace(serialized, profile.user_id)


@router.get("/investigations/{investigation_id}/workspaces", response_model=list[WorkspaceSummary])
def list_workspaces(
    investigation_id: Annotated[str, Path(min_length=1, max_length=80)],
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> list[WorkspaceSummary]:
    _require_case_access(repository, profile, investigation_id)
    return [WorkspaceSummary.model_validate(item) for item in repository.list_graph_workspaces(investigation_id, profile.user_id)]


@router.post("/investigations/{investigation_id}/workspaces", response_model=GraphWorkspace, status_code=status.HTTP_201_CREATED)
def create_workspace(
    investigation_id: Annotated[str, Path(min_length=1, max_length=80)],
    payload: WorkspaceCreate,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> GraphWorkspace:
    _require_case_access(repository, profile, investigation_id)
    workspace = repository.create_graph_workspace(investigation_id, profile.user_id, payload.model_dump())
    _audit(repository, profile, "WORKSPACE_CREATED", workspace["id"], investigation_id)
    return GraphWorkspace.model_validate(workspace)


@router.get("/workspaces/{workspace_id}", response_model=GraphWorkspace)
def get_workspace(
    workspace_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> GraphWorkspace:
    workspace = repository.get_graph_workspace(workspace_id, profile.user_id)
    if not workspace:
        raise HTTPException(status_code=404, detail={"code": "WORKSPACE_NOT_FOUND", "message": "Workspace not found."})
    return GraphWorkspace.model_validate(workspace)


@router.patch("/workspaces/{workspace_id}", response_model=GraphWorkspace)
def save_workspace(
    workspace_id: UUID,
    payload: WorkspaceSave,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> GraphWorkspace:
    if payload.id != workspace_id:
        raise HTTPException(status_code=422, detail={"code": "WORKSPACE_ID_MISMATCH", "message": "Workspace identifiers do not match."})
    _require_case_access(repository, profile, payload.investigation_id)
    existing = repository.get_graph_workspace(workspace_id, profile.user_id)
    if existing and payload.version < existing["version"]:
        raise HTTPException(status_code=409, detail={"code": "WORKSPACE_VERSION_CONFLICT", "message": "A newer workspace version is already stored."})
    try:
        workspace = repository.save_graph_workspace(payload.model_dump(mode="json"), profile.user_id)
    except PermissionError as error:
        raise HTTPException(status_code=404, detail={"code": "WORKSPACE_NOT_FOUND", "message": "Workspace not found."}) from error
    if not existing:
        _audit(repository, profile, "WORKSPACE_CREATED", workspace_id, payload.investigation_id)
    old_nodes = {str(item["id"]): item for item in (existing or {}).get("nodes", [])}
    new_nodes = {str(item.id): item for item in payload.nodes}
    for node_id in new_nodes.keys() - old_nodes.keys():
        action = "CASE_ENTITY_IMPORTED" if new_nodes[node_id].origin == "investigation" else "NODE_CREATED"
        repository.record_audit(profile=profile, action=action, resource_type="graph_workspace_node", resource_id=node_id, investigation_id=payload.investigation_id)
    for node_id in old_nodes.keys() - new_nodes.keys():
        repository.record_audit(profile=profile, action="NODE_DELETED", resource_type="graph_workspace_node", resource_id=node_id, investigation_id=payload.investigation_id)
    old_edges = {str(item["id"]) for item in (existing or {}).get("edges", [])}
    new_edges = {str(item.id) for item in payload.edges}
    for edge_id in new_edges - old_edges:
        repository.record_audit(profile=profile, action="EDGE_CREATED", resource_type="graph_workspace_edge", resource_id=edge_id, investigation_id=payload.investigation_id)
    for edge_id in old_edges - new_edges:
        repository.record_audit(profile=profile, action="EDGE_DELETED", resource_type="graph_workspace_edge", resource_id=edge_id, investigation_id=payload.investigation_id)

    old_suggestions = {str(item["id"]): item for item in (existing or {}).get("suggestions", [])}
    new_suggestions = {str(item.id): item for item in payload.suggestions}
    old_conflicts = {str(item["id"]): item for item in (existing or {}).get("conflicts", [])}
    new_conflicts = {str(item.id): item for item in payload.conflicts}
    if new_suggestions.keys() - old_suggestions.keys() or new_conflicts.keys() - old_conflicts.keys():
        _audit(repository, profile, "AI_ANALYSIS_REQUESTED", workspace_id, payload.investigation_id)
    for suggestion_id in new_suggestions.keys() & old_suggestions.keys():
        old_status = old_suggestions[suggestion_id].get("status")
        new_status = new_suggestions[suggestion_id].status
        if old_status == new_status:
            continue
        if new_status == "ACCEPTED_AS_HYPOTHESIS":
            _audit(repository, profile, "AI_SUGGESTION_ACCEPTED", workspace_id, payload.investigation_id)
        elif new_status == "REJECTED":
            _audit(repository, profile, "AI_SUGGESTION_REJECTED", workspace_id, payload.investigation_id)
    for conflict_id in new_conflicts.keys() & old_conflicts.keys():
        if old_conflicts[conflict_id].get("status") != new_conflicts[conflict_id].status:
            _audit(repository, profile, "CONFLICT_REVIEWED", workspace_id, payload.investigation_id)

    old_questions = {str(item["id"]): item for item in (existing or {}).get("questions", [])}
    new_questions = {str(item.id): item for item in payload.questions}
    for question_id in new_questions.keys() - old_questions.keys():
        _audit(repository, profile, "QUESTION_CREATED", workspace_id, payload.investigation_id)
    for question_id in new_questions.keys() & old_questions.keys():
        if old_questions[question_id].get("status") != "RESOLVED" and new_questions[question_id].status == "RESOLVED":
            _audit(repository, profile, "QUESTION_RESOLVED", workspace_id, payload.investigation_id)

    old_snapshots = {str(item["id"]): item for item in (existing or {}).get("snapshots", [])}
    for item in payload.snapshots:
        if str(item.id) in old_snapshots:
            continue
        action = "SNAPSHOT_RESTORED" if item.name.startswith("BACKUP BEFORE ") else "SNAPSHOT_CREATED"
        _audit(repository, profile, action, workspace_id, payload.investigation_id)
    return GraphWorkspace.model_validate(workspace)


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    workspace_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> Response:
    workspace = repository.get_graph_workspace(workspace_id, profile.user_id)
    if not workspace:
        raise HTTPException(status_code=404, detail={"code": "WORKSPACE_NOT_FOUND", "message": "Workspace not found."})
    if not repository.delete_graph_workspace(workspace_id, profile.user_id):
        raise HTTPException(status_code=404, detail={"code": "WORKSPACE_NOT_FOUND", "message": "Workspace not found."})
    _audit(repository, profile, "WORKSPACE_DELETED", workspace_id, workspace["investigation_id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/workspaces/{workspace_id}/path", response_model=WorkspacePathResponse)
def find_path(
    workspace_id: UUID,
    payload: WorkspacePathRequest,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> WorkspacePathResponse:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    node_ids = {UUID(str(node["id"])) for node in workspace.get("nodes", [])}
    if payload.from_node_id not in node_ids or payload.to_node_id not in node_ids:
        raise HTTPException(status_code=422, detail={"code": "WORKSPACE_NODE_NOT_FOUND", "message": "Path endpoints must be nodes in the current workspace."})
    return WorkspacePathResponse.model_validate(find_documented_path(workspace, payload.from_node_id, payload.to_node_id, payload.max_hops, payload.relationship_types))


@router.post("/workspaces/{workspace_id}/analyze", response_model=WorkspaceAnalysisResponse)
def analyze_connections(
    workspace_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    settings: Annotated[Settings, Depends(get_runtime_settings)],
) -> WorkspaceAnalysisResponse:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    investigation_id = workspace["investigation_id"]
    facts, _ = repository.get_facts(investigation_id, limit=1000)
    investigation = {
        "map": repository.get_map(investigation_id),
        "graph": repository.get_network(investigation_id),
        "timeline": repository.get_timeline(investigation_id),
        "facts": facts,
    }
    analysis = analyze_workspace(workspace, investigation)
    provider = configured_connection_provider(settings)
    if provider is not None:
        try:
            analysis = provider.refine(analysis, workspace)
        except Exception:
            logger.warning("openai_workspace_analysis_unavailable", exc_info=True)
    workspace["suggestions"] = analysis["suggestions"]
    workspace["conflicts"] = analysis["conflicts"]
    _save(repository, profile, workspace)
    _audit(repository, profile, "AI_ANALYSIS_REQUESTED", workspace_id, workspace["investigation_id"])
    return WorkspaceAnalysisResponse.model_validate(analysis)


@router.get("/workspaces/{workspace_id}/suggestions", response_model=list[WorkspaceSuggestion])
def list_suggestions(
    workspace_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> list[WorkspaceSuggestion]:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    return [WorkspaceSuggestion.model_validate(item) for item in workspace.get("suggestions", [])]


@router.patch("/workspaces/{workspace_id}/suggestions/{suggestion_id}", response_model=WorkspaceSuggestion)
def review_suggestion(
    workspace_id: UUID,
    suggestion_id: UUID,
    payload: SuggestionReview,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> WorkspaceSuggestion:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    suggestion = next((item for item in workspace.get("suggestions", []) if UUID(str(item["id"])) == suggestion_id), None)
    if not suggestion:
        raise HTTPException(status_code=404, detail={"code": "SUGGESTION_NOT_FOUND", "message": "Suggestion not found."})
    if suggestion["status"] != "PENDING":
        raise HTTPException(status_code=409, detail={"code": "SUGGESTION_ALREADY_REVIEWED", "message": "Suggestion was already reviewed."})
    suggestion["status"] = payload.status
    suggestion["reviewed_at"] = datetime.now(timezone.utc)
    if payload.status == "ACCEPTED_AS_HYPOTHESIS":
        duplicate = any(str(edge["source"]) == str(suggestion["source_node_id"]) and str(edge["target"]) == str(suggestion["target_node_id"]) for edge in workspace.get("edges", []))
        if not duplicate:
            workspace.setdefault("edges", []).append({
                "id": uuid4(), "source": suggestion["source_node_id"], "target": suggestion["target_node_id"],
                "relationship_type": suggestion["suggested_relationship"], "label": suggestion["suggested_relationship"],
                "confidence": "hypothesis", "verification_status": "hypothesis",
                "reason": suggestion["explanation"], "source_ref": None, "basis": [],
                "intelligence_origin": "AI_SUGGESTED_ANALYST_ACCEPTED",
            })
    _save(repository, profile, workspace)
    action = "AI_SUGGESTION_ACCEPTED" if payload.status == "ACCEPTED_AS_HYPOTHESIS" else "AI_SUGGESTION_REJECTED"
    _audit(repository, profile, action, workspace_id, workspace["investigation_id"])
    return WorkspaceSuggestion.model_validate(suggestion)


@router.get("/workspaces/{workspace_id}/conflicts", response_model=list[WorkspaceConflict])
def list_conflicts(
    workspace_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> list[WorkspaceConflict]:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    return [WorkspaceConflict.model_validate(item) for item in workspace.get("conflicts", [])]


@router.patch("/workspaces/{workspace_id}/conflicts/{conflict_id}", response_model=WorkspaceConflict)
def review_conflict(
    workspace_id: UUID,
    conflict_id: UUID,
    payload: ConflictReview,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> WorkspaceConflict:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    conflict = next((item for item in workspace.get("conflicts", []) if UUID(str(item["id"])) == conflict_id), None)
    if not conflict:
        raise HTTPException(status_code=404, detail={"code": "CONFLICT_NOT_FOUND", "message": "Conflict not found."})
    conflict["status"] = payload.status
    conflict["reviewed_at"] = datetime.now(timezone.utc)
    _save(repository, profile, workspace)
    _audit(repository, profile, "CONFLICT_REVIEWED", workspace_id, workspace["investigation_id"])
    return WorkspaceConflict.model_validate(conflict)


@router.get("/workspaces/{workspace_id}/questions", response_model=list[WorkspaceQuestion])
def list_questions(
    workspace_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> list[WorkspaceQuestion]:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    return [WorkspaceQuestion.model_validate(item) for item in workspace.get("questions", [])]


@router.post("/workspaces/{workspace_id}/questions", response_model=WorkspaceQuestion, status_code=status.HTTP_201_CREATED)
def create_question(
    workspace_id: UUID,
    payload: QuestionCreate,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> WorkspaceQuestion:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    now = datetime.now(timezone.utc)
    question = {"id": uuid4(), **payload.model_dump(), "status": "OPEN", "created_at": now, "updated_at": now, "resolved_at": None}
    workspace.setdefault("questions", []).append(question)
    _save(repository, profile, workspace)
    _audit(repository, profile, "QUESTION_CREATED", workspace_id, workspace["investigation_id"])
    return WorkspaceQuestion.model_validate(question)


@router.patch("/workspaces/{workspace_id}/questions/{question_id}", response_model=WorkspaceQuestion)
def update_question(
    workspace_id: UUID,
    question_id: UUID,
    payload: QuestionUpdate,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> WorkspaceQuestion:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    question = next((item for item in workspace.get("questions", []) if UUID(str(item["id"])) == question_id), None)
    if not question:
        raise HTTPException(status_code=404, detail={"code": "QUESTION_NOT_FOUND", "message": "Question not found."})
    previous_status = question["status"]
    question.update(payload.model_dump(exclude_none=True))
    question["updated_at"] = datetime.now(timezone.utc)
    question["resolved_at"] = question["updated_at"] if question["status"] == "RESOLVED" else None
    _save(repository, profile, workspace)
    if previous_status != "RESOLVED" and question["status"] == "RESOLVED":
        _audit(repository, profile, "QUESTION_RESOLVED", workspace_id, workspace["investigation_id"])
    return WorkspaceQuestion.model_validate(question)


@router.delete("/workspaces/{workspace_id}/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    workspace_id: UUID,
    question_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> Response:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    before = len(workspace.get("questions", []))
    workspace["questions"] = [item for item in workspace.get("questions", []) if UUID(str(item["id"])) != question_id]
    if len(workspace["questions"]) == before:
        raise HTTPException(status_code=404, detail={"code": "QUESTION_NOT_FOUND", "message": "Question not found."})
    _save(repository, profile, workspace)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _snapshot_data(workspace: dict) -> dict:
    keys = ("name", "description", "nodes", "edges", "groups", "questions", "suggestions", "conflicts", "viewport", "filters", "version")
    return {key: workspace[key] for key in keys}


@router.get("/workspaces/{workspace_id}/snapshots", response_model=list[WorkspaceSnapshot])
def list_snapshots(
    workspace_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> list[WorkspaceSnapshot]:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    return [WorkspaceSnapshot.model_validate(item) for item in workspace.get("snapshots", [])]


@router.post("/workspaces/{workspace_id}/snapshots", response_model=WorkspaceSnapshot, status_code=status.HTTP_201_CREATED)
def create_snapshot(
    workspace_id: UUID,
    payload: SnapshotCreate,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> WorkspaceSnapshot:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    item = {"id": uuid4(), **payload.model_dump(), "created_at": datetime.now(timezone.utc), "snapshot_data": _snapshot_data(workspace)}
    workspace.setdefault("snapshots", []).append(item)
    _save(repository, profile, workspace)
    _audit(repository, profile, "SNAPSHOT_CREATED", workspace_id, workspace["investigation_id"])
    return WorkspaceSnapshot.model_validate(item)


@router.get("/workspaces/{workspace_id}/snapshots/{snapshot_id}", response_model=WorkspaceSnapshot)
def get_snapshot(
    workspace_id: UUID,
    snapshot_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> WorkspaceSnapshot:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    item = next((snapshot for snapshot in workspace.get("snapshots", []) if UUID(str(snapshot["id"])) == snapshot_id), None)
    if not item:
        raise HTTPException(status_code=404, detail={"code": "SNAPSHOT_NOT_FOUND", "message": "Snapshot not found."})
    return WorkspaceSnapshot.model_validate(item)


@router.post("/workspaces/{workspace_id}/snapshots/{snapshot_id}/restore", response_model=GraphWorkspace)
def restore_snapshot(
    workspace_id: UUID,
    snapshot_id: UUID,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> GraphWorkspace:
    workspace = _workspace_or_404(repository, profile, workspace_id)
    item = next((snapshot for snapshot in workspace.get("snapshots", []) if UUID(str(snapshot["id"])) == snapshot_id), None)
    if not item:
        raise HTTPException(status_code=404, detail={"code": "SNAPSHOT_NOT_FOUND", "message": "Snapshot not found."})
    backup = {"id": uuid4(), "name": f"BACKUP BEFORE {item['name']}", "description": "Automatic backup created before snapshot restore.", "created_at": datetime.now(timezone.utc), "snapshot_data": _snapshot_data(workspace)}
    snapshots = [*workspace.get("snapshots", []), backup]
    workspace.update(item["snapshot_data"])
    workspace["snapshots"] = snapshots
    saved = _save(repository, profile, workspace)
    _audit(repository, profile, "SNAPSHOT_RESTORED", workspace_id, workspace["investigation_id"])
    return GraphWorkspace.model_validate(saved)
