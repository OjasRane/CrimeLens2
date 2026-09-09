from __future__ import annotations

import os
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

os.environ["ENVIRONMENT"] = "test"

from backend.app.core.config import Settings
from backend.app.core.security import AuthenticatedIdentity, TokenVerificationError
from backend.app.main import create_app
from backend.app.schemas.auth import AuthorizedProfile
from backend.app.services.repository import MemoryInvestigationRepository


INVESTIGATOR_ID = UUID("00000000-0000-0000-0000-000000000001")
INACTIVE_ID = UUID("00000000-0000-0000-0000-000000000002")
SUPERVISOR_ID = UUID("00000000-0000-0000-0000-000000000003")
RESTRICTED_ID = UUID("00000000-0000-0000-0000-000000000004")


class FakeVerifier:
    identities = {
        "valid": AuthenticatedIdentity(INVESTIGATOR_ID, "agent@example.gov"),
        "inactive": AuthenticatedIdentity(INACTIVE_ID, "inactive@example.gov"),
        "supervisor": AuthenticatedIdentity(SUPERVISOR_ID, "supervisor@example.gov"),
        "restricted": AuthenticatedIdentity(RESTRICTED_ID, "restricted@example.gov"),
    }

    def verify(self, token: str) -> AuthenticatedIdentity:
        if token in {"malformed", "expired"} or token not in self.identities:
            raise TokenVerificationError("invalid token")
        return self.identities[token]


@pytest.fixture()
def repository() -> MemoryInvestigationRepository:
    repo = MemoryInvestigationRepository.from_seed_file()
    repo.add_profile(AuthorizedProfile(user_id=INVESTIGATOR_ID, agent_id="CR-0174", display_name="Investigator One", role="investigator", clearance_level="level_red", active=True))
    repo.add_profile(AuthorizedProfile(user_id=INACTIVE_ID, agent_id="CR-0999", display_name="Inactive User", role="analyst", clearance_level="standard", active=False))
    repo.add_profile(AuthorizedProfile(user_id=SUPERVISOR_ID, agent_id="CR-0001", display_name="Duty Supervisor", role="supervisor", clearance_level="level_red", active=True))
    repo.add_profile(AuthorizedProfile(user_id=RESTRICTED_ID, agent_id="CR-1000", display_name="Restricted User", role="investigator", clearance_level="standard", active=True))
    repo.access[("mumbai-2611", str(RESTRICTED_ID))] = False
    return repo


@pytest.fixture()
def client(repository: MemoryInvestigationRepository):
    application = create_app(
        settings=Settings(environment="test", rate_limit_per_minute=10_000),
        repository=repository,
        jwt_verifier=FakeVerifier(),
    )
    with TestClient(application) as test_client:
        yield test_client


def auth(token: str = "valid") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
