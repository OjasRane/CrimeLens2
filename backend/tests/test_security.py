from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from backend.app.core.config import Settings
from backend.app.core.security import SupabaseJwtVerifier, TokenVerificationError
from backend.tests.conftest import auth


def _verifier_and_key():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    verifier = SupabaseJwtVerifier(Settings(environment="test", supabase_url="https://crime.supabase.co"))
    verifier._jwks_client = SimpleNamespace(get_signing_key_from_jwt=lambda _token: SimpleNamespace(key=private_key.public_key()))
    return verifier, private_key


def _token(private_key, **overrides):
    now = datetime.now(timezone.utc)
    claims = {"sub": "00000000-0000-0000-0000-000000000001", "iss": "https://crime.supabase.co/auth/v1", "aud": "authenticated", "iat": now, "exp": now + timedelta(minutes=5), **overrides}
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test"})


def test_real_signature_validation_accepts_valid_supabase_claims():
    verifier, key = _verifier_and_key()
    assert verifier.verify(_token(key)).user_id == UUID("00000000-0000-0000-0000-000000000001")


@pytest.mark.parametrize("overrides", [{"exp": datetime.now(timezone.utc) - timedelta(seconds=1)}, {"iss": "https://attacker.supabase.co/auth/v1"}, {"aud": "anonymous"}])
def test_real_signature_validation_rejects_invalid_registered_claims(overrides):
    verifier, key = _verifier_and_key()
    with pytest.raises(TokenVerificationError):
        verifier.verify(_token(key, **overrides))


def test_agent_id_and_liveblocks_room_id_cannot_authenticate(client):
    assert client.get("/api/v1/me", headers=auth("CR-0174")).status_code == 401
    assert client.get("/api/v1/me", headers=auth("demo-room")).status_code == 401


def test_client_cannot_assign_role_or_clearance(client):
    response = client.get("/api/v1/audit/recent?role=admin&clearanceLevel=level_red", headers=auth())
    assert response.status_code == 403


def test_production_configuration_fails_early_without_services():
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        Settings(
            environment="production",
            database_url=None,
            supabase_url=None,
            _env_file=None,
        ).validate_runtime()
