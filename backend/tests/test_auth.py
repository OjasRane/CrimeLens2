from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from backend.app import main


class _ClaimsAuth:
    def __init__(self, claims):
        self._claims = claims

    def get_claims(self, _token):
        return SimpleNamespace(claims=self._claims)


class _SupabaseClient:
    def __init__(self, claims):
        self.auth = _ClaimsAuth(claims)


class SupabaseAuthenticationTests(TestCase):
    def test_missing_bearer_token_is_rejected(self):
        with self.assertRaises(HTTPException) as context:
            main.require_supabase_user(None)
        self.assertEqual(context.exception.status_code, 401)

    def test_verified_supabase_claims_resolve_only_the_user_subject(self):
        claims = {
            "sub": "0db89f00-6d85-45ec-a927-ae911413ece7",
            "email": "investigator@example.gov",
            "iss": "https://crime.supabase.co/auth/v1",
            "aud": "authenticated",
        }
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="redacted.jwt.value",
        )

        with (
            patch.object(main, "SUPABASE_URL", "https://crime.supabase.co"),
            patch.object(main, "supabase_client", _SupabaseClient(claims)),
        ):
            user = main.require_supabase_user(credentials)

        self.assertEqual(user.user_id, claims["sub"])
        self.assertEqual(user.email, claims["email"])

    def test_token_from_a_different_supabase_project_is_rejected(self):
        claims = {
            "sub": "0db89f00-6d85-45ec-a927-ae911413ece7",
            "iss": "https://attacker.supabase.co/auth/v1",
            "aud": "authenticated",
        }
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="redacted.jwt.value",
        )

        with (
            patch.object(main, "SUPABASE_URL", "https://crime.supabase.co"),
            patch.object(main, "supabase_client", _SupabaseClient(claims)),
            self.assertRaises(HTTPException) as context,
        ):
            main.require_supabase_user(credentials)

        self.assertEqual(context.exception.status_code, 401)

    def test_inactive_authorization_profile_is_denied(self):
        user = main.AuthenticatedUser(user_id="user-id")
        inactive = main.AuthorizedProfile(
            user_id="user-id",
            agent_id="CR-0001",
            display_name="Inactive Investigator",
            role="investigator",
            clearance="LEVEL AMBER",
            active=False,
        )

        with (
            patch.object(main, "_load_authorized_profile", return_value=inactive),
            self.assertRaises(HTTPException) as context,
        ):
            main.require_active_profile(user)

        self.assertEqual(context.exception.status_code, 403)

    def test_legacy_kinetic_auth_is_disabled_by_default(self):
        with (
            patch.object(main, "LEGACY_KINETIC_AUTH_ENABLED", False),
            self.assertRaises(HTTPException) as context,
        ):
            main.require_legacy_kinetic_auth()

        self.assertEqual(context.exception.status_code, 410)

