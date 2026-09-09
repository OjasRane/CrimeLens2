from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from ..dependencies import get_repository, require_roles
from ...core.permissions import Role
from ...schemas.auth import AuthorizedProfile
from ...schemas.investigations import AuditLogResponse
from ...services.repository import InvestigationRepository


router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("/recent", response_model=list[AuditLogResponse])
def recent_audit(
    response: Response,
    _profile: Annotated[
        AuthorizedProfile,
        Depends(require_roles(Role.SUPERVISOR, Role.ADMIN)),
    ],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AuditLogResponse]:
    response.headers["Cache-Control"] = "private, no-store"
    return [AuditLogResponse.model_validate(item) for item in repository.recent_audit(limit, offset)]
