from __future__ import annotations

from uuid import uuid4

from backend.tests.conftest import auth


def test_workspace_crud_is_owner_scoped_and_does_not_mutate_case(client):
    before = client.get("/api/v1/investigations/demo/network", headers=auth()).json()
    created = client.post(
        "/api/v1/investigations/demo/workspaces",
        headers=auth(),
        json={"name": "LOCATION THEORY", "description": "Analyst reasoning"},
    )
    assert created.status_code == 201
    workspace = created.json()
    assert workspace["nodes"] == [] and workspace["ownerUserId"]

    node_id = str(uuid4())
    workspace["nodes"] = [{
        "id": node_id, "type": "location", "label": "TAJ MAHAL PALACE",
        "origin": "investigation", "verificationStatus": "verified",
        "sourceEntityId": "loc-taj", "investigationId": "demo",
        "description": "Referenced case entity", "metadata": {},
        "position": {"x": 120, "y": 180},
    }]
    saved = client.patch(f"/api/v1/workspaces/{workspace['id']}", headers=auth(), json=workspace)
    assert saved.status_code == 200
    assert saved.json()["nodes"][0]["sourceEntityId"] == "loc-taj"

    assert client.get(f"/api/v1/workspaces/{workspace['id']}", headers=auth("restricted")).status_code == 404
    assert client.delete(f"/api/v1/workspaces/{workspace['id']}", headers=auth()).status_code == 204
    after = client.get("/api/v1/investigations/demo/network", headers=auth()).json()
    assert after == before


def test_workspace_requires_investigation_access(client):
    response = client.post(
        "/api/v1/investigations/mumbai-2611/workspaces",
        headers=auth("restricted"),
        json={"name": "DENIED", "description": ""},
    )
    assert response.status_code == 403
