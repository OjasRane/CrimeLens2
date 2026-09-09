from __future__ import annotations

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Path, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..core.config import Settings
from ..core.permissions import Role, can_access_investigation, normalize_role
from ..core.security import AuthenticatedIdentity, TokenVerificationError
from ..schemas.auth import AuthorizedProfile
from ..services.repository import InvestigationRepository
from ..services.evidence_repository import EvidenceRepository


bearer_scheme = HTTPBearer(auto_error=False)


def get_repository(request: Request) -> InvestigationRepository:
    return request.app.state.repository


def get_evidence_repository(request: Request) -> EvidenceRepository:
    return request.app.state.evidence_repository


def get_runtime_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_current_identity(
    request: Request,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Security(bearer_scheme),
    ],
) -> AuthenticatedIdentity:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "AUTHENTICATION_REQUIRED",
                "message": "A Supabase bearer token is required.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return request.app.state.jwt_verifier.verify(credentials.credentials)
    except TokenVerificationError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_ACCESS_TOKEN",
                "message": "The Supabase access token is invalid or expired.",
            },
            headers={"WWW-Authenticate": "Bearer"},
        ) from error


def require_active_profile(
    identity: Annotated[AuthenticatedIdentity, Depends(get_current_identity)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> AuthorizedProfile:
    profile = repository.get_profile(identity.user_id)
    if profile is None or not profile.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "ACTIVE_PROFILE_REQUIRED",
                "message": "An active CrimeLens authorization profile is required.",
            },
        )
    return profile


def require_roles(*allowed: Role) -> Callable:
    def dependency(
        profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    ) -> AuthorizedProfile:
        if normalize_role(profile.role) not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "ROLE_REQUIRED",
                    "message": "This operation requires elevated CrimeLens authorization.",
                },
            )
        return profile

    return dependency


def require_investigation_access(
    investigation_id: Annotated[str, Path(min_length=1, max_length=80)],
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> dict:
    investigation = repository.get_investigation(investigation_id)
    if investigation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "INVESTIGATION_NOT_FOUND",
                "message": "Investigation not found.",
            },
        )
    if not can_access_investigation(
        active=profile.active,
        user_clearance=profile.clearance_level,
        classification=investigation["classification"],
        is_demo=investigation["isDemo"],
        has_explicit_access=repository.has_explicit_access(
            investigation_id, profile.user_id
        ),
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "INVESTIGATION_ACCESS_DENIED",
                "message": "Your role or clearance does not permit this investigation.",
            },
        )
    return investigation
