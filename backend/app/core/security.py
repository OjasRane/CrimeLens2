from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

import jwt
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError

from .config import Settings


class TokenVerificationError(ValueError):
    """Raised when a bearer token cannot be trusted."""


@dataclass(frozen=True, slots=True)
class AuthenticatedIdentity:
    user_id: UUID
    email: str | None = None


class SupabaseJwtVerifier:
    """Verify Supabase JWTs against the project's cached public JWKS."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._jwks_client = (
            PyJWKClient(
                settings.jwks_url,
                cache_keys=True,
                cache_jwk_set=True,
                lifespan=300,
                timeout=5,
            )
            if settings.jwks_url
            else None
        )

    def verify(self, token: str) -> AuthenticatedIdentity:
        if not token or self._jwks_client is None or not self._settings.jwt_issuer:
            raise TokenVerificationError("Supabase JWT verification is not configured")

        try:
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            claims: dict[str, Any] = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                audience=self._settings.supabase_jwt_audience,
                issuer=self._settings.jwt_issuer,
                options={
                    "require": ["exp", "iat", "sub", "iss", "aud"],
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iss": True,
                    "verify_aud": True,
                },
            )
            user_id = UUID(str(claims["sub"]))
        except (InvalidTokenError, KeyError, TypeError, ValueError) as error:
            raise TokenVerificationError("Invalid or expired Supabase access token") from error

        email = claims.get("email")
        return AuthenticatedIdentity(
            user_id=user_id,
            email=email if isinstance(email, str) else None,
        )
