from backend.tests.conftest import auth


def _payload():
    return {
        "entityId": "attacker-kasab",
        "startObservation": {"eventId":"MUM-TL-001","locationId":"loc-badhwar","observedAt":"2008-11-26T21:20:00+05:30","earliestAt":"2008-11-26T21:15:00+05:30","latestAt":"2008-11-26T21:30:00+05:30","timePrecision":"WINDOW","associationKind":"DOCUMENTED_SIGHTING"},
        "endObservation": {"eventId":"MUM-TL-006","locationId":"loc-cst","observedAt":"2008-11-26T21:55:00+05:30","earliestAt":"2008-11-26T21:50:00+05:30","latestAt":"2008-11-26T22:00:00+05:30","timePrecision":"APPROX","associationKind":"DOCUMENTED_SIGHTING"},
        "travelMode":"vehicle","speedKmh":40,"selectedTime":"2008-11-26T21:37:30+05:30",
    }


def test_gap_endpoints_require_authentication_and_case_access(client):
    assert client.get("/api/v1/investigations/demo/cameras").status_code == 401
    assert client.get("/api/v1/investigations/mumbai-2611/cameras", headers=auth("restricted")).status_code == 403


def test_preview_save_load_review_and_case_isolation(client, repository):
    canonical_counts = repository.counts("mumbai-2611")
    camera = client.post("/api/v1/investigations/mumbai-2611/cameras", headers=auth(), json={"label":"Synthetic Colaba demo camera","coordinates":{"latitude":18.94,"longitude":72.835},"sourceRef":"SYNTHETIC-GAP-FIXTURE-001","isSynthetic":True,"recordingAvailability":"UNKNOWN","retentionInformation":"Unknown; demonstration inventory only"})
    assert camera.status_code == 201
    camera_id = camera.json()["id"]
    assert client.get("/api/v1/investigations/demo/cameras", headers=auth()).json() == []

    preview = client.post("/api/v1/investigations/mumbai-2611/gap-reconstructions/preview", headers=auth(), json=_payload())
    assert preview.status_code == 200, preview.text
    body = preview.json()
    assert body["isEnvelope"] is True
    assert body["startTime"].endswith("+05:30")
    assert body["modelLabel"].startswith("Straight-line")
    assert body["candidates"][0]["camera"]["id"] == camera_id

    saved = client.post("/api/v1/investigations/mumbai-2611/gap-reconstructions", headers=auth(), json=_payload())
    assert saved.status_code == 201
    run_id = saved.json()["id"]
    loaded = client.get(f"/api/v1/investigations/mumbai-2611/gap-reconstructions/{run_id}", headers=auth())
    assert loaded.status_code == 200
    review = client.patch(f"/api/v1/investigations/mumbai-2611/gap-reconstructions/{run_id}/cameras/{camera_id}/review", headers=auth(), json={"status":"REQUESTED","notes":"Preservation request drafted."})
    assert review.status_code == 200
    assert review.json()["status"] == "REQUESTED"
    assert repository.counts("mumbai-2611") == canonical_counts


def test_mentions_and_unbounded_approximate_times_are_rejected(client):
    payload = _payload(); payload["startObservation"].pop("earliestAt")
    assert client.post("/api/v1/investigations/mumbai-2611/gap-reconstructions/preview", headers=auth(), json=payload).status_code == 422
    payload = _payload(); payload["entityId"] = "attacker-imran"
    response = client.post("/api/v1/investigations/mumbai-2611/gap-reconstructions/preview", headers=auth(), json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "SIGHTING_NOT_DOCUMENTED"


def test_non_operational_camera_is_excluded(client):
    client.post("/api/v1/investigations/mumbai-2611/cameras", headers=auth(), json={"label":"Closed camera","coordinates":{"latitude":18.94,"longitude":72.835},"sourceRef":"TEST-CLOSED","operationalTo":"2008-11-20T00:00:00+05:30","recordingAvailability":"UNKNOWN"})
    body = client.post("/api/v1/investigations/mumbai-2611/gap-reconstructions/preview", headers=auth(), json=_payload()).json()
    assert body["candidates"] == []
    assert body["excludedCameras"][0]["operationalStatus"] == "NON_OPERATIONAL"


def test_missing_coordinates_and_impossible_travel_are_informative(client):
    payload = _payload()
    payload["startObservation"].update({"locationId":"loc-kuber","associationKind":"ANALYST_ASSUMPTION","analystAssumptionNote":"Testing an explicit association pending coordinate verification."})
    missing = client.post("/api/v1/investigations/mumbai-2611/gap-reconstructions/preview", headers=auth(), json=payload)
    assert missing.status_code == 422
    assert missing.json()["error"]["code"] == "OBSERVATION_LOCATION_MISSING"
    payload = _payload(); payload["speedKmh"] = 0.1
    impossible = client.post("/api/v1/investigations/mumbai-2611/gap-reconstructions/preview", headers=auth(), json=payload)
    assert impossible.status_code == 200
    assert impossible.json()["feasible"] is False
    assert "empty" in impossible.json()["reason"].lower()
