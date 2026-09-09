from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    INVESTIGATOR = "investigator"
    ANALYST = "analyst"
    SUPERVISOR = "supervisor"
    ADMIN = "admin"


class Clearance(StrEnum):
    STANDARD = "standard"
    RESTRICTED = "restricted"
    CLASSIFIED = "classified"
    LEVEL_RED = "level_red"


ROLE_ALIASES = {
    "case-admin": Role.ADMIN,
    "case_admin": Role.ADMIN,
    "viewer": Role.INVESTIGATOR,
}

CLEARANCE_ALIASES = {
    "level red": Clearance.LEVEL_RED,
    "level-red": Clearance.LEVEL_RED,
    "level amber": Clearance.RESTRICTED,
}

CLEARANCE_RANK = {
    Clearance.STANDARD: 0,
    Clearance.RESTRICTED: 1,
    Clearance.CLASSIFIED: 2,
    Clearance.LEVEL_RED: 3,
}


def normalize_role(value: str) -> Role:
    normalized = value.strip().lower()
    if normalized in ROLE_ALIASES:
        return ROLE_ALIASES[normalized]
    try:
        return Role(normalized)
    except ValueError:
        return Role.INVESTIGATOR


def normalize_clearance(value: str) -> Clearance:
    normalized = value.strip().lower().replace("_", " ")
    if normalized in CLEARANCE_ALIASES:
        return CLEARANCE_ALIASES[normalized]
    normalized = normalized.replace(" ", "_")
    try:
        return Clearance(normalized)
    except ValueError:
        return Clearance.STANDARD


def can_access_investigation(
    *,
    active: bool,
    user_clearance: str,
    classification: str,
    is_demo: bool,
    has_explicit_access: bool | None,
) -> bool:
    if not active:
        return False
    if has_explicit_access is False:
        return False
    if is_demo:
        return True
    required = normalize_clearance(classification)
    actual = normalize_clearance(user_clearance)
    return CLEARANCE_RANK[actual] >= CLEARANCE_RANK[required]
