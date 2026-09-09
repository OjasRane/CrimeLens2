from __future__ import annotations

import hashlib
import io

from pypdf import PdfWriter

from backend.tests.conftest import auth


SYNTHETIC_TEXT = b"""SYNTHETIC DEMO DATA
ENTITY: PERSON | Rhea Sen
ENTITY: VEHICLE | Unit 12
LOCATION: Harbor Service Gate
EVENT: 2026-08-30 | around 21:30 | Vehicle observed | Unit 12 was recorded near the service gate.
RELATIONSHIP: Rhea Sen -> Unit 12 | USES
"""


def _upload(client, tmp_path, content=SYNTHETIC_TEXT, filename="sample_witness_statement.txt", mime="text/plain"):
    client.app.state.settings.evidence_storage_dir = str(tmp_path)
    return client.post(
        "/api/v1/investigations/demo/evidence",
        headers=auth(),
        data={"source_type": "WITNESS STATEMENT", "description": "Synthetic evidence fixture"},
        files={"file": (filename, content, mime)},
    )


def test_upload_hashes_extracts_and_does_not_change_case_before_commit(client, repository, tmp_path):
    before = repository.counts("demo")
    response = _upload(client, tmp_path)
    assert response.status_code == 202
    evidence = response.json()
    assert evidence["displayId"].startswith("EV-")
    assert evidence["sha256"] == hashlib.sha256(SYNTHETIC_TEXT).hexdigest()
    assert evidence["processingStatus"] == "UPLOADED"

    stored = client.get(f"/api/v1/evidence/{evidence['id']}", headers=auth()).json()
    assert stored["processingStatus"] == "PENDING_REVIEW"
    extraction = client.get(f"/api/v1/evidence/{evidence['id']}/extraction", headers=auth())
    assert extraction.status_code == 200
    assert extraction.json()["counts"] == {
        "entities": 2,
        "locations": 1,
        "events": 1,
        "datesTimes": 1,
        "relationships": 1,
        "conflicts": 0,
    }
    assert repository.counts("demo") == before


def test_candidate_review_commit_and_idempotency(client, repository, tmp_path):
    evidence = _upload(client, tmp_path).json()
    extraction = client.get(f"/api/v1/evidence/{evidence['id']}/extraction", headers=auth()).json()
    for index, candidate in enumerate(extraction["candidates"]):
        if candidate["candidateType"] == "DATE_TIME":
            payload = {"reviewStatus": "REJECTED"}
        elif index == 0:
            edited = candidate["candidatePayload"] | {"label": "Rhea Sen (reviewed)"}
            payload = {"reviewStatus": "EDITED_ACCEPTED", "candidatePayload": edited}
        else:
            payload = {"reviewStatus": "ACCEPTED"}
        response = client.patch(
            f"/api/v1/evidence/{evidence['id']}/candidates/{candidate['id']}",
            headers=auth(),
            json=payload,
        )
        assert response.status_code == 200

    before = repository.counts("demo")
    committed = client.post(f"/api/v1/evidence/{evidence['id']}/commit", headers=auth())
    assert committed.status_code == 200
    assert committed.json() | {} == {
        "evidenceId": evidence["id"],
        "alreadyCommitted": False,
        "entitiesCreated": 2,
        "entitiesMerged": 0,
        "locationsCreated": 1,
        "eventsCreated": 1,
        "relationshipsCreated": 1,
        "factsCreated": 4,
    }
    after = repository.counts("demo")
    assert after["entities"] == before["entities"] + 2
    assert after["locations"] == before["locations"] + 1
    assert after["timelineEvents"] == before["timelineEvents"] + 1
    assert after["relationships"] == before["relationships"] + 1
    assert after["facts"] == before["facts"] + 4
    facts, _ = repository.get_facts("demo", limit=250)
    assert any(fact.get("sourceEvidenceId") == evidence["id"] for fact in facts)
    assert client.get("/api/v1/investigations/demo/network", headers=auth()).status_code == 200
    assert client.get("/api/v1/investigations/demo/map", headers=auth()).status_code == 200
    assert client.get("/api/v1/investigations/demo/timeline", headers=auth()).status_code == 200
    assert client.get("/api/v1/investigations/demo/facts?limit=250", headers=auth()).status_code == 200

    duplicate = client.post(f"/api/v1/evidence/{evidence['id']}/commit", headers=auth())
    assert duplicate.status_code == 200
    assert duplicate.json()["alreadyCommitted"] is True
    assert repository.counts("demo") == after

    reviewed_candidate = extraction["candidates"][0]
    locked_review = client.patch(
        f"/api/v1/evidence/{evidence['id']}/candidates/{reviewed_candidate['id']}",
        headers=auth(),
        json={"reviewStatus": "REJECTED"},
    )
    assert locked_review.status_code == 409
    assert locked_review.json()["error"]["code"] == "INVALID_REVIEW"
    assert repository.counts("demo") == after


def test_possible_duplicate_requires_human_resolution(client, tmp_path):
    evidence = _upload(client, tmp_path, b"ENTITY: PERSON | ADA CROSS\n", "duplicate.txt").json()
    candidate = client.get(f"/api/v1/evidence/{evidence['id']}/extraction", headers=auth()).json()["candidates"][0]
    duplicate = candidate["candidatePayload"]["possibleDuplicate"]
    assert duplicate["existingEntityId"] == "sus-ada"
    accepted = client.patch(
        f"/api/v1/evidence/{evidence['id']}/candidates/{candidate['id']}",
        headers=auth(), json={"reviewStatus": "ACCEPTED"},
    )
    assert accepted.status_code == 200
    blocked = client.post(f"/api/v1/evidence/{evidence['id']}/commit", headers=auth())
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "COMMIT_BLOCKED"


def test_valid_image_is_ingested_but_never_hallucinated(client, tmp_path):
    response = _upload(client, tmp_path, b"\x89PNG\r\n\x1a\nsynthetic", "frame.png", "image/png")
    assert response.status_code == 202
    item = client.get(f"/api/v1/evidence/{response.json()['id']}", headers=auth()).json()
    assert item["processingStatus"] == "FAILED"
    assert "Manual review required" in item["failureReason"]


def test_valid_csv_json_and_pdf_are_accepted(client, tmp_path):
    csv_response = _upload(client, tmp_path, b"kind,label\nPERSON,Rhea Sen\n", "records.csv", "text/csv")
    json_response = _upload(client, tmp_path, b'{"kind":"PERSON","label":"Rhea Sen"}', "records.json", "application/json")
    buffer = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.write(buffer)
    pdf_response = _upload(client, tmp_path, buffer.getvalue(), "scan.pdf", "application/pdf")
    assert csv_response.status_code == 202
    assert json_response.status_code == 202
    assert pdf_response.status_code == 202
    # A valid but textless PDF is retained and explicitly routed to manual review.
    pdf_item = client.get(f"/api/v1/evidence/{pdf_response.json()['id']}", headers=auth()).json()
    assert pdf_item["processingStatus"] == "FAILED"


def test_unsupported_and_oversized_uploads_are_rejected(client, tmp_path):
    unsupported = _upload(client, tmp_path, b"binary", "archive.zip", "application/zip")
    assert unsupported.status_code == 415
    assert unsupported.json()["error"]["code"] == "UNSUPPORTED_EVIDENCE_TYPE"

    client.app.state.settings.max_upload_mb = 1
    oversized = _upload(client, tmp_path, b"x" * (1024 * 1024 + 1), "large.txt")
    assert oversized.status_code == 413
    assert oversized.json()["error"]["code"] == "EVIDENCE_TOO_LARGE"


def test_hash_changes_when_bytes_change():
    assert hashlib.sha256(b"same").hexdigest() == hashlib.sha256(b"same").hexdigest()
    assert hashlib.sha256(b"same").hexdigest() != hashlib.sha256(b"changed").hexdigest()


def test_search_activity_history_status_and_report_use_recorded_data(client, tmp_path):
    evidence = _upload(client, tmp_path).json()
    search = client.get("/api/v1/investigations/demo/search?q=sample_witness", headers=auth())
    assert search.status_code == 200
    assert any(item["resultType"] == "EVIDENCE" and item["id"] == evidence["id"] for item in search.json())
    status = client.get("/api/v1/investigations/demo/status", headers=auth()).json()
    assert status["pendingReview"] == 1
    activity = client.get("/api/v1/investigations/demo/activity", headers=auth()).json()
    assert any(item["eventType"] == "EVIDENCE_UPLOADED" for item in activity)
    history = client.get(f"/api/v1/evidence/{evidence['id']}/history", headers=auth()).json()
    assert {item["eventType"] for item in history} >= {
        "EVIDENCE_UPLOADED", "CONTENT_EXTRACTED", "AI_EXTRACTION_COMPLETED"
    }
    report = client.post(
        "/api/v1/investigations/demo/reports",
        headers=auth(),
        json={"include": ["overview", "entities", "timeline", "evidence"]},
    )
    assert report.status_code == 200
    assert report.json()["status"] == "AI_ASSISTED_DRAFT"
    assert "INVESTIGATOR REVIEW REQUIRED" in report.json()["content"]
    assert report.json()["id"] in client.app.state.evidence_repository.reports
