from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from ..dependencies import get_repository
from ...services.repository import InvestigationRepository


router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "crimelens-api"}


@router.get("/ready")
def readiness(
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
) -> dict[str, str]:
    try:
        ready = repository.ready()
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SERVICE_NOT_READY",
                "message": "The investigation database is not ready.",
            },
        ) from error
    if not ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "SERVICE_NOT_READY",
                "message": "The investigation database is not ready.",
            },
        )
    return {"status": "ready"}
