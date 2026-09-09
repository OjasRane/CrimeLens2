from __future__ import annotations

from uuid import UUID

from pydantic import Field

from .common import ApiModel


class AuthorizedProfile(ApiModel):
    user_id: UUID
    agent_id: str = Field(min_length=1, max_length=50)
    display_name: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=50)
    clearance_level: str = Field(min_length=1, max_length=30)
    active: bool


class CurrentUserResponse(ApiModel):
    user_id: UUID
    agent_id: str
    display_name: str
    role: str
    clearance_level: str
