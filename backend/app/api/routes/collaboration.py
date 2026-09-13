from typing import Annotated
import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import Field
from ..dependencies import get_repository, get_runtime_settings, require_active_profile
from ...schemas.auth import AuthorizedProfile
from ...schemas.common import ApiModel
from ...services.repository import InvestigationRepository
from ...core.config import Settings
from ...services.private_cases import membership_role

router = APIRouter(prefix="/api/v1", tags=["collaboration"])

class RoomRequest(ApiModel):
    room: str = Field(min_length=1, max_length=100)
    investigation_id: str = Field(min_length=1, max_length=80)

@router.post("/collaboration/auth")
def authorize_room(payload: RoomRequest, response: Response,
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
    repository: Annotated[InvestigationRepository, Depends(get_repository)],
    settings: Annotated[Settings, Depends(get_runtime_settings)]):
    case = repository.get_investigation(payload.investigation_id)
    if not case or case.get("accessMode") != "private" or case.get("roomId") != payload.room or repository.has_explicit_access(payload.investigation_id, profile.user_id) is not True:
        raise HTTPException(403, detail={"code":"ROOM_ACCESS_DENIED", "message":"Explicit case membership is required for this room."})
    # This MUST be a separate Liveblocks project from the legacy public-key project.
    # Disabled until the operator confirms public auth is off in that isolated project.
    if not settings.liveblocks_private_secret_key or not settings.liveblocks_private_project_isolated:
        raise HTTPException(503, detail={"code":"COLLABORATION_NOT_CONFIGURED", "message":"Private collaboration is not configured."})
    permissions = ["*:write"] if membership_role(repository, payload.investigation_id, profile.user_id) in {"owner", "editor", "investigator"} else ["*:read"]
    try:
        with httpx.Client(timeout=10) as client:
            result = client.post("https://api.liveblocks.io/v2/authorize-user",
                headers={"Authorization": "Bearer " + settings.liveblocks_private_secret_key},
                json={"userId":str(profile.user_id), "userInfo":{"name":profile.display_name}, "permissions":{payload.room:permissions}})
            result.raise_for_status()
            token = result.json()["token"]
    except (httpx.HTTPError, KeyError, ValueError) as error:
        raise HTTPException(503, detail={"code":"COLLABORATION_UNAVAILABLE", "message":"Collaboration connection failed. Retry shortly."}) from error
    response.headers["Cache-Control"] = "no-store"
    return {"token":token}
