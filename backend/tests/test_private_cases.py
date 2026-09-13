from copy import deepcopy
from uuid import uuid4, UUID
import pytest
from backend.tests.conftest import auth, INVESTIGATOR_ID, RESTRICTED_ID


def create(client, token="valid", key=None, name="Private case"):
    return client.post("/api/v1/investigations", headers=auth(token), json={"name":name,"description":"Analyst's own question", "requestId":str(key or uuid4())})


def test_creation_is_owned_empty_idempotent_and_preserves_demos(client, repository):
    before = deepcopy(repository.investigations)
    key = uuid4()
    response = create(client, key=key)
    assert response.status_code == 201, response.text
    case = response.json()
    UUID(case["id"])
    assert case["id"] != case["roomId"] != str(INVESTIGATOR_ID)
    assert case["accessMode"] == "private" and case["isDemo"] is False
    assert repository.has_explicit_access(case["id"], INVESTIGATOR_ID) is True
    assert create(client, key=key).json()["id"] == case["id"]
    assert create(client, key=key, name="Different").status_code == 409
    for part, field in [("map","locations"),("network","nodes"),("timeline","events"),("facts","facts")]:
        result = client.get(f"/api/v1/investigations/{case['id']}/{part}", headers=auth())
        assert result.status_code == 200, result.text
        assert result.json()[field] == []
    assert all(repository.investigations[k] == v for k,v in before.items())


def test_public_accounts_only_see_memberships_even_with_clearance(client, repository):
    repository.profiles[str(INVESTIGATOR_ID)] = repository.get_profile(INVESTIGATOR_ID).model_copy(update={"public_account":True})
    assert client.get("/api/v1/investigations", headers=auth()).json() == []
    for id in ("demo","mumbai-2611"):
        assert client.get(f"/api/v1/investigations/{id}", headers=auth()).status_code == 403
    own = create(client).json()
    assert [c["id"] for c in client.get("/api/v1/investigations",headers=auth()).json()] == [own["id"]]
    assert client.get("/api/v1/audit/recent",headers=auth()).status_code == 403


@pytest.mark.parametrize("part",["", "/map", "/timeline", "/network", "/facts", "/evidence", "/pins", "/workspaces"])
def test_cross_user_case_data_denied_even_for_supervisor(client, part):
    case = create(client).json()
    for token in ("restricted", "supervisor"):
        assert client.get(f"/api/v1/investigations/{case['id']}{part}",headers=auth(token)).status_code == 403


def test_guest_cannot_create_write_or_authorize_rooms(client):
    assert client.post("/api/v1/investigations",json={"name":"x","requestId":str(uuid4())}).status_code == 401
    for case in ("demo","mumbai-2611"):
        assert client.post(f"/api/v1/investigations/{case}/workspaces",json={"name":"x"}).status_code == 401
        assert client.post(f"/api/v1/investigations/{case}/pins",json={"title":"x","latitude":0,"longitude":0,"category":"custom"}).status_code == 401
    assert client.post("/api/v1/collaboration/auth",json={"room":"legacy","investigationId":"demo"}).status_code == 401


def test_room_requires_matching_mapping_membership_and_configuration(client, repository):
    case=create(client).json()
    body={"room":case["roomId"],"investigationId":case["id"]}
    assert client.post("/api/v1/collaboration/auth",headers=auth("restricted"),json=body).status_code == 403
    assert client.post("/api/v1/collaboration/auth",headers=auth(),json=body | {"room":"private-board-forged"}).status_code == 403
    assert client.post("/api/v1/collaboration/auth",headers=auth(),json=body).status_code == 503
    repository.access[(case["id"],str(INVESTIGATOR_ID))]=False
    assert client.post("/api/v1/collaboration/auth",headers=auth(),json=body).status_code == 403


def test_workspace_persists_rename_and_revocation_is_enforced(client, repository):
    case=create(client).json()
    workspace=client.post(f"/api/v1/investigations/{case['id']}/workspaces",headers=auth(),json={"name":"Theory"}).json()
    workspace["name"]="Revised theory"
    result=client.patch(f"/api/v1/workspaces/{workspace['id']}",headers=auth(),json=workspace)
    assert result.status_code == 200, result.text
    assert client.get(f"/api/v1/workspaces/{workspace['id']}",headers=auth()).json()["name"] == "Revised theory"
    assert client.get(f"/api/v1/workspaces/{workspace['id']}",headers=auth("restricted")).status_code == 404
    assert client.patch(f"/api/v1/workspaces/{workspace['id']}",headers=auth("restricted"),json=workspace).status_code == 403
    repository.access[(case["id"],str(INVESTIGATOR_ID))]=False
    assert client.get(f"/api/v1/workspaces/{workspace['id']}",headers=auth()).status_code == 403
    assert client.delete(f"/api/v1/workspaces/{workspace['id']}",headers=auth()).status_code == 403


def test_private_evidence_ingestion_and_cross_account_denial(client, repository, tmp_path):
    case=create(client).json()
    client.app.state.settings.evidence_storage_dir=str(tmp_path)
    result=client.post(f"/api/v1/investigations/{case['id']}/evidence",headers=auth(),data={"source_type":"WITNESS STATEMENT"},files={"file":("notes.txt",b"ENTITY: PERSON | Test witness", "text/plain")})
    assert result.status_code == 202, result.text
    evidence=result.json()
    for suffix in ("", "/extraction", "/history"):
        assert client.get(f"/api/v1/evidence/{evidence['id']}{suffix}",headers=auth("restricted")).status_code == 403
    assert client.post(f"/api/v1/evidence/{evidence['id']}/commit",headers=auth("supervisor")).status_code == 403
    extraction=client.get(f"/api/v1/evidence/{evidence['id']}/extraction",headers=auth()).json()
    for candidate in extraction["candidates"]:
        assert client.patch(f"/api/v1/evidence/{evidence['id']}/candidates/{candidate['id']}",headers=auth(),json={"reviewStatus":"ACCEPTED"}).status_code == 200
    assert client.post(f"/api/v1/evidence/{evidence['id']}/commit",headers=auth()).status_code == 200
    assert repository.counts(case["id"])["entities"] == 1


def test_room_tokens_are_exactly_scoped_and_viewers_are_read_only(client, repository, monkeypatch):
    case=create(client).json()
    settings=client.app.state.settings
    settings.liveblocks_private_secret_key="sk_test_local_fixture"
    settings.liveblocks_private_project_isolated=True
    captured=[]
    class Result:
        def raise_for_status(self): pass
        def json(self): return {"token":"mock-room-token"}
    class FakeHttp:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, url, **kwargs):
            captured.append(kwargs["json"])
            return Result()
    monkeypatch.setattr("backend.app.api.routes.collaboration.httpx.Client",FakeHttp)
    body={"room":case["roomId"],"investigationId":case["id"]}
    result=client.post("/api/v1/collaboration/auth",headers=auth(),json=body)
    assert result.status_code==200
    assert result.headers["cache-control"]=="no-store"
    assert captured[-1]["permissions"]=={case["roomId"]:["*:write"]}
    repository.access[(case["id"],str(RESTRICTED_ID))]=True
    result=client.post("/api/v1/collaboration/auth",headers=auth("restricted"),json=body)
    assert result.status_code==200
    assert captured[-1]["permissions"]=={case["roomId"]:["*:read"]}
