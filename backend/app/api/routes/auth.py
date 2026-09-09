from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response

from ..dependencies import require_active_profile
from ...schemas.auth import AuthorizedProfile, CurrentUserResponse


router = APIRouter(prefix="/api/v1", tags=["identity"])


def _current_user(profile: AuthorizedProfile, response: Response) -> CurrentUserResponse:
    response.headers["Cache-Control"] = "private, no-store"
    return CurrentUserResponse(
        user_id=profile.user_id,
        agent_id=profile.agent_id,
        display_name=profile.display_name,
        role=profile.role,
        clearance_level=profile.clearance_level,
    )


@router.get("/me", response_model=CurrentUserResponse)
def get_current_user(
    response: Response,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
) -> CurrentUserResponse:
    return _current_user(profile, response)


@router.get("/auth/me", response_model=CurrentUserResponse, deprecated=True)
def get_current_user_compatibility(
    response: Response,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
) -> CurrentUserResponse:
    return _current_user(profile, response)
