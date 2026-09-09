from __future__ import annotations

from backend.tests.conftest import auth


def test_health_and_readiness_are_safe_and_public(client):
    assert client.get("/health").json() == {"status": "ok", "service": "crimelens-api"}
    assert client.get("/ready").json() == {"status": "ready"}


def test_missing_jwt_is_rejected(client):
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"


def test_malformed_and_expired_jwts_are_rejected(client):
    for token in ("malformed", "expired"):
        response = client.get("/api/v1/me", headers=auth(token))
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "INVALID_ACCESS_TOKEN"


def test_valid_jwt_returns_only_trusted_profile_fields(client):
    response = client.get("/api/v1/me", headers=auth())
    assert response.status_code == 200
    assert response.json() == {
        "userId": "00000000-0000-0000-0000-000000000001",
        "agentId": "CR-0174",
        "displayName": "Investigator One",
        "role": "investigator",
        "clearanceLevel": "level_red",
    }
    assert response.headers["cache-control"] == "private, no-store"


def test_inactive_profile_is_rejected(client):
    response = client.get("/api/v1/investigations", headers=auth("inactive"))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ACTIVE_PROFILE_REQUIRED"


def test_unauthorized_role_cannot_read_audit(client):
    response = client.get("/api/v1/audit/recent", headers=auth())
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ROLE_REQUIRED"
    assert client.get("/api/v1/audit/recent", headers=auth("supervisor")).status_code == 200


def test_lists_both_authorized_investigations(client):
    response = client.get("/api/v1/investigations", headers=auth())
    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == ["demo", "mumbai-2611"]
    assert response.headers["x-total-count"] == "2"


def test_valid_investigation_and_overview(client):
    detail = client.get("/api/v1/investigations/demo", headers=auth())
    assert detail.status_code == 200
    assert detail.json()["caseId"] == "DEMO-001"
    overview = client.get("/api/v1/investigations/demo/overview", headers=auth())
    assert overview.status_code == 200
    assert overview.json()["counts"] == {"locations": 18, "entities": 10, "relationships": 12, "timelineEvents": 18, "facts": 4}


def test_unknown_and_unauthorized_investigations_are_distinct(client):
    unknown = client.get("/api/v1/investigations/not-real", headers=auth())
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "INVESTIGATION_NOT_FOUND"
    denied = client.get("/api/v1/investigations/mumbai-2611", headers=auth("restricted"))
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "INVESTIGATION_ACCESS_DENIED"


def test_map_returns_valid_coordinates_and_filters(client):
    response = client.get("/api/v1/investigations/mumbai-2611/map?importance=CRITICAL", headers=auth())
    assert response.status_code == 200
    locations = response.json()["locations"]
    assert locations and all(item["importance"] == "CRITICAL" for item in locations)
    for location in locations:
        if location["coordinates"]:
            longitude, latitude = location["coordinates"]
            assert -180 <= longitude <= 180
            assert -90 <= latitude <= 90


def test_invalid_map_bounds_have_safe_error(client):
    response = client.get("/api/v1/investigations/demo/map?bounds=bad", headers=auth())
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "INVALID_BOUNDS"


def test_network_edges_reference_nodes(client):
    graph = client.get("/api/v1/investigations/mumbai-2611/network", headers=auth()).json()
    ids = {node["id"] for node in graph["nodes"]}
    assert all(edge["source"] in ids and edge["target"] in ids for edge in graph["edges"])


def test_network_layer_and_entity_filtering(client):
    layer = client.get("/api/v1/investigations/demo/network?layers=phone", headers=auth()).json()
    assert layer["edges"] and all(edge["linkKind"] == "phone" for edge in layer["edges"])
    entity = client.get("/api/v1/investigations/demo/network?entityId=sus-ada&hops=1", headers=auth()).json()
    assert "sus-ada" in {node["id"] for node in entity["nodes"]}
    assert len(entity["nodes"]) < 10


def test_timeline_is_sorted_and_preserves_precision(client):
    events = client.get("/api/v1/investigations/mumbai-2611/timeline", headers=auth()).json()["events"]
    assert [event["sortOrder"] for event in events] == sorted(event["sortOrder"] for event in events)
    assert any(event["timePrecision"] in {"APPROX", "WINDOW"} for event in events)


def test_timeline_date_filtering(client):
    response = client.get("/api/v1/investigations/mumbai-2611/timeline?from=2008-11-28&to=2008-11-29", headers=auth())
    assert response.status_code == 200
    assert all("2008-11-28" <= event["date"] <= "2008-11-29" for event in response.json()["events"])


def test_fact_filtering_and_references(client):
    body = client.get("/api/v1/investigations/demo/facts?status=pending", headers=auth()).json()
    assert body["total"] == 2
    assert all(fact["status"] == "pending" for fact in body["facts"])
    graph = client.get("/api/v1/investigations/demo/network", headers=auth()).json()
    entity_ids = {node["id"] for node in graph["nodes"]}
    assert all(set(fact["linkedEntityIds"]).issubset(entity_ids) for fact in body["facts"])


def test_entity_and_location_inspectors_use_same_ids(client):
    entity = client.get("/api/v1/investigations/mumbai-2611/entities/attacker-kasab", headers=auth())
    assert entity.status_code == 200 and entity.json()["entity"]["id"] == "attacker-kasab"
    location = client.get("/api/v1/investigations/mumbai-2611/locations/loc-taj", headers=auth())
    assert location.status_code == 200 and location.json()["location"]["graphNodeId"] == "loc-taj"


def test_historical_responses_include_etag_and_request_id(client):
    response = client.get("/api/v1/investigations/mumbai-2611/map", headers={**auth(), "X-Request-ID": "judge-demo-1"})
    assert response.headers["x-request-id"] == "judge-demo-1"
    assert response.headers["etag"].startswith('"')
    assert "max-age=300" in response.headers["cache-control"]
