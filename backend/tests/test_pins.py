from __future__ import annotations

from uuid import UUID

import pytest
from pydantic import ValidationError

from backend.app import pins_router
from backend.app.core.config import Settings
from backend.app.schemas.auth import AuthorizedProfile


def _profile(role: str = "investigator") -> AuthorizedProfile:
    return AuthorizedProfile(user_id=UUID("00000000-0000-0000-0000-000000000001"), agent_id="CR-0174", display_name="Investigator One", role=role, clearance_level="level_red", active=True)


def test_pin_route_uses_investigation_id_and_requires_authentication(client):
    response = client.get("/api/v1/investigations/demo/pins")
    assert response.status_code == 401


def test_pin_coordinates_and_client_ownership_are_validated():
    with pytest.raises(ValidationError):
        pins_router.PinCreate(latitude=91, longitude=72.8347, title="Out-of-range pin", category="lead")
    with pytest.raises(ValidationError):
        pins_router.PinCreate.model_validate({"latitude": 18.922, "longitude": 72.8347, "title": "Gateway review point", "category": "point_of_interest", "createdBy": "attacker-controlled-value", "investigationId": "mumbai-2611"})


def test_cross_investigation_pin_link_is_rejected():
    with pytest.raises(Exception) as error:
        pins_router._validate_links("demo", "evidence-judgment", None, None)
    assert error.value.status_code == 422


def test_read_only_profile_cannot_write():
    assert not pins_router._can_write(_profile("viewer"))
    assert pins_router._can_write(_profile())


def test_pin_database_url_uses_runtime_settings():
    settings = Settings(environment="test", database_url="postgresql://runtime-settings")
    assert pins_router._database_url(settings) == "postgresql://runtime-settings"
