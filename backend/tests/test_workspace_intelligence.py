from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from backend.tests.conftest import auth
from backend.app.services.workspace_intelligence import analyze_workspace


def create_workspace(client, name="INTELLIGENCE TEST"):
    response = client.post(
        "/api/v1/investigations/demo/workspaces",
        headers=auth(),
        json={"name": name, "description": "Reasoning test"},
    )
    assert response.status_code == 201
    return response.json()


def manual_node(label: str):
    return {
        "id": str(uuid4()), "type": "person", "label": label,
        "origin": "manual", "verificationStatus": "manual",
        "intelligenceOrigin": "INVESTIGATOR_CREATED",
        "description": "", "metadata": {}, "position": {"x": 0, "y": 0},
    }


def test_attribute_conflict_detects_divergent_copies_of_same_case_record():
    source_id = "ENTITY-001"
    workspace = {
        "nodes": [
            {**manual_node("Original label"), "sourceEntityId": source_id},
            {**manual_node("Edited label"), "sourceEntityId": source_id},
        ],
        "edges": [],
        "suggestions": [],
        "conflicts": [],
    }
    investigation = {
        "map": {"locations": []},
        "timeline": {"events": []},
        "facts": [],
    }

    result = analyze_workspace(workspace, investigation)

    assert [item["conflict_type"] for item in result["conflicts"]] == ["ATTRIBUTE_CONFLICT"]


def test_path_finder_uses_only_documented_workspace_edges(client):
    workspace = create_workspace(client)
    workspace["nodes"] = [manual_node("A"), manual_node("B"), manual_node("C")]
    workspace["edges"] = [
        {"id": str(uuid4()), "source": workspace["nodes"][0]["id"], "target": workspace["nodes"][1]["id"], "relationshipType": "CONTACTED", "label": "CONTACTED", "confidence": "medium", "verificationStatus": "manual", "basis": []},
        {"id": str(uuid4()), "source": workspace["nodes"][1]["id"], "target": workspace["nodes"][2]["id"], "relationshipType": "LOCATED AT", "label": "LOCATED AT", "confidence": "medium", "verificationStatus": "manual", "basis": []},
    ]
    saved = client.patch(f"/api/v1/workspaces/{workspace['id']}", headers=auth(), json=workspace)
    assert saved.status_code == 200
    path = client.post(
        f"/api/v1/workspaces/{workspace['id']}/path",
        headers=auth(),
        json={"fromNodeId": workspace["nodes"][0]["id"], "toNodeId": workspace["nodes"][2]["id"], "maxHops": 2},
    )
    assert path.status_code == 200
    assert path.json()["hops"] == 2
    no_path = client.post(
        f"/api/v1/workspaces/{workspace['id']}/path",
        headers=auth(),
        json={"fromNodeId": workspace["nodes"][0]["id"], "toNodeId": workspace["nodes"][2]["id"], "maxHops": 1},
    )
    assert no_path.status_code == 200 and no_path.json()["found"] is False


def test_suggestion_review_never_creates_verified_relationship(client):
    workspace = create_workspace(client)
    network = client.get("/api/v1/investigations/demo/network", headers=auth()).json()
    facts = client.get("/api/v1/investigations/demo/facts", headers=auth()).json()["facts"]
    fact = next(item for item in facts if item["linkedEntityIds"])
    entity = next(item for item in network["nodes"] if item["id"] == fact["linkedEntityIds"][0])
    workspace["nodes"] = [
        {
            "id": str(uuid4()), "type": "person", "label": entity["label"], "origin": "investigation",
            "verificationStatus": "verified", "intelligenceOrigin": "CASE_DATABASE", "sourceEntityId": entity["id"],
            "description": entity["subtitle"], "metadata": {}, "position": {"x": 0, "y": 0},
        },
        {
            "id": str(uuid4()), "type": "evidence", "label": fact["sourceTitle"], "origin": "investigation",
            "verificationStatus": "verified", "intelligenceOrigin": "CASE_DATABASE", "sourceFactId": fact["id"],
            "description": fact["text"], "metadata": {}, "position": {"x": 200, "y": 0},
        },
    ]
    assert client.patch(f"/api/v1/workspaces/{workspace['id']}", headers=auth(), json=workspace).status_code == 200
    analysis = client.post(f"/api/v1/workspaces/{workspace['id']}/analyze", headers=auth(), json={})
    assert analysis.status_code == 200
    assert analysis.json()["provider"] == "deterministic" and analysis.json()["aiAvailable"] is False
    suggestion = analysis.json()["suggestions"][0]
    accepted = client.patch(
        f"/api/v1/workspaces/{workspace['id']}/suggestions/{suggestion['id']}",
        headers=auth(),
        json={"status": "ACCEPTED_AS_HYPOTHESIS"},
    )
    assert accepted.status_code == 200
    saved = client.get(f"/api/v1/workspaces/{workspace['id']}", headers=auth()).json()
    assert len(saved["edges"]) == 1
    assert saved["edges"][0]["verificationStatus"] == "hypothesis"
    assert saved["edges"][0]["intelligenceOrigin"] == "AI_SUGGESTED_ANALYST_ACCEPTED"


def test_rejected_suggestion_does_not_become_edge(client):
    workspace = create_workspace(client)
    network = client.get("/api/v1/investigations/demo/network", headers=auth()).json()
    facts = client.get("/api/v1/investigations/demo/facts", headers=auth()).json()["facts"]
    fact = next(item for item in facts if item["linkedEntityIds"])
    entity = next(item for item in network["nodes"] if item["id"] == fact["linkedEntityIds"][0])
    workspace["nodes"] = [
        {**manual_node(entity["label"]), "origin": "investigation", "verificationStatus": "verified", "intelligenceOrigin": "CASE_DATABASE", "sourceEntityId": entity["id"]},
        {**manual_node(fact["sourceTitle"]), "type": "evidence", "origin": "investigation", "verificationStatus": "verified", "intelligenceOrigin": "CASE_DATABASE", "sourceFactId": fact["id"]},
    ]
    assert client.patch(f"/api/v1/workspaces/{workspace['id']}", headers=auth(), json=workspace).status_code == 200
    analysis = client.post(f"/api/v1/workspaces/{workspace['id']}/analyze", headers=auth(), json={})
    assert analysis.status_code == 200
    suggestion = analysis.json()["suggestions"][0]
    rejected = client.patch(
        f"/api/v1/workspaces/{workspace['id']}/suggestions/{suggestion['id']}",
        headers=auth(),
        json={"status": "REJECTED"},
    )
    assert rejected.status_code == 200 and rejected.json()["status"] == "REJECTED"
    assert client.get(f"/api/v1/workspaces/{workspace['id']}", headers=auth()).json()["edges"] == []


def test_ai_provider_failure_returns_deterministic_analysis(client, monkeypatch):
    class FailingProvider:
        def refine(self, _analysis, _workspace):
            raise TimeoutError("provider unavailable")

    monkeypatch.setattr(
        "backend.app.api.routes.workspaces.configured_connection_provider",
        lambda _settings: FailingProvider(),
    )
    workspace = create_workspace(client, "PROVIDER FALLBACK")

    response = client.post(
        f"/api/v1/workspaces/{workspace['id']}/analyze",
        headers=auth(),
        json={},
    )

    assert response.status_code == 200
    assert response.json()["provider"] == "deterministic"
    assert response.json()["aiAvailable"] is False


def test_questions_and_snapshots_are_owner_scoped_and_restore_with_backup(client, repository):
    workspace = create_workspace(client)
    created_question = client.post(
        f"/api/v1/workspaces/{workspace['id']}/questions",
        headers=auth(),
        json={"questionText": "WHO USED DEVICE 17?", "notes": "Check call records", "links": []},
    )
    assert created_question.status_code == 201
    resolved = client.patch(
        f"/api/v1/workspaces/{workspace['id']}/questions/{created_question.json()['id']}",
        headers=auth(),
        json={"status": "RESOLVED"},
    )
    assert resolved.status_code == 200 and resolved.json()["resolvedAt"]
    snapshot = client.post(
        f"/api/v1/workspaces/{workspace['id']}/snapshots",
        headers=auth(),
        json={"name": "BEFORE REVIEW", "description": "Known-good reasoning state"},
    )
    assert snapshot.status_code == 201
    changed = client.get(f"/api/v1/workspaces/{workspace['id']}", headers=auth()).json()
    changed["nodes"] = [manual_node("TEMPORARY NODE")]
    assert client.patch(f"/api/v1/workspaces/{workspace['id']}", headers=auth(), json=changed).status_code == 200
    restored = client.post(
        f"/api/v1/workspaces/{workspace['id']}/snapshots/{snapshot.json()['id']}/restore",
        headers=auth(),
        json={},
    )
    assert restored.status_code == 200
    assert restored.json()["nodes"] == []
    assert len(restored.json()["snapshots"]) == 2
    assert client.get(f"/api/v1/workspaces/{workspace['id']}/questions", headers=auth("restricted")).status_code == 404
    actions = {item["action"] for item in repository.audit}
    assert {"QUESTION_CREATED", "QUESTION_RESOLVED", "SNAPSHOT_CREATED", "SNAPSHOT_RESTORED"} <= actions


def test_workspace_autosave_audits_intelligence_and_review_transitions(client, repository):
    workspace = create_workspace(client, "AUDIT TEST")
    workspace["nodes"] = [manual_node("A"), manual_node("B")]
    now = datetime.now(timezone.utc).isoformat()
    workspace["suggestions"] = [{
        "id": str(uuid4()),
        "signature": "suggestion:a:b:SHARED_LOCATION",
        "sourceNodeId": workspace["nodes"][0]["id"],
        "targetNodeId": workspace["nodes"][1]["id"],
        "suggestedRelationship": "ASSOCIATED WITH",
        "status": "PENDING",
        "reasonCodes": ["SHARED_LOCATION"],
        "explanation": "Shared location signal; analyst review required.",
        "signalStrength": "LOW",
        "createdAt": now,
        "reviewedAt": None,
    }]
    workspace["conflicts"] = [{
        "id": str(uuid4()),
        "signature": "duplicate:a:b",
        "conflictType": "DUPLICATE_IDENTITY",
        "resourceAType": "node",
        "resourceAId": workspace["nodes"][0]["id"],
        "resourceBType": "node",
        "resourceBId": workspace["nodes"][1]["id"],
        "status": "OPEN",
        "explanation": "Potential duplicate; analyst review required.",
        "createdAt": now,
        "reviewedAt": None,
    }]
    workspace["questions"] = [{
        "id": str(uuid4()),
        "questionText": "Are these records connected?",
        "status": "OPEN",
        "notes": "",
        "links": [],
        "createdAt": now,
        "updatedAt": now,
        "resolvedAt": None,
    }]
    saved = client.patch(f"/api/v1/workspaces/{workspace['id']}", headers=auth(), json=workspace)
    assert saved.status_code == 200
    updated = saved.json()
    updated["suggestions"][0]["status"] = "ACCEPTED_AS_HYPOTHESIS"
    updated["suggestions"][0]["reviewedAt"] = now
    updated["conflicts"][0]["status"] = "REVIEWED"
    updated["conflicts"][0]["reviewedAt"] = now
    updated["questions"][0]["status"] = "RESOLVED"
    updated["questions"][0]["resolvedAt"] = now
    updated["questions"][0]["updatedAt"] = now
    assert client.patch(f"/api/v1/workspaces/{workspace['id']}", headers=auth(), json=updated).status_code == 200

    actions = [item["action"] for item in repository.audit]
    assert "AI_ANALYSIS_REQUESTED" in actions
    assert "AI_SUGGESTION_ACCEPTED" in actions
    assert "CONFLICT_REVIEWED" in actions
    assert "QUESTION_CREATED" in actions
    assert "QUESTION_RESOLVED" in actions
