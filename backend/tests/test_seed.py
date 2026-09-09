from __future__ import annotations

from pathlib import Path

from backend.app.db.seed import load_seed_payload, validate_seed_payload


def _investigations():
    return validate_seed_payload(load_seed_payload())


def test_seed_contains_demo_and_mumbai_without_replacement():
    assert {item["id"] for item in _investigations()} == {"demo", "mumbai-2611"}


def test_mumbai_verified_invariants():
    mumbai = next(item for item in _investigations() if item["id"] == "mumbai-2611")
    attackers = [item for item in mumbai["graph"]["nodes"] if item["kind"] == "attacker"]
    teams = [item for item in mumbai["graph"]["nodes"] if item["kind"] == "team"]
    assert len(attackers) == 10
    assert len(teams) == 5
    assert sum(item.get("status") == "CAPTURED" for item in attackers) == 1
    assert sum(item["killed"] for item in mumbai["casualtyLedger"]) == 166
    assert sum(item["injured"] for item in mumbai["casualtyLedger"]) == 238


def test_every_mumbai_event_has_source_and_timezone_metadata():
    mumbai = next(item for item in _investigations() if item["id"] == "mumbai-2611")
    assert all(event["sourceRef"] for event in mumbai["timeline"]["events"])
    assert all(event["timezone"] == "Asia/Kolkata" for event in mumbai["timeline"]["events"])


def test_liveblocks_room_contract_is_still_independent():
    root = Path(__file__).parents[2]
    runtime = (root / "components/liveblocks-runtime.tsx").read_text(encoding="utf-8")
    assert 'searchParams.get("case")' in runtime
    assert "roomId={requestedCase}" in runtime
    assert "activeInvestigationId" not in runtime


def test_service_role_key_is_not_exposed_to_next_client():
    root = Path(__file__).parents[2]
    sources = list((root / "app").rglob("*.tsx")) + list((root / "components").rglob("*.tsx")) + list((root / "lib").rglob("*.ts"))
    contents = "\n".join(path.read_text(encoding="utf-8") for path in sources)
    assert "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" not in contents
