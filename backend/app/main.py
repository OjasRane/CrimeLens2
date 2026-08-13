from __future__ import annotations

import os
from typing import Annotated

import psycopg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.http import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from supabase import Client, create_client

from .timeline_router import router as timeline_router
from .pins_router import build_pins_router


load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase_client: Client | None = (
    create_client(SUPABASE_URL, SUPABASE_KEY)
    if SUPABASE_URL and SUPABASE_KEY
    else None
)
bearer_scheme = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    user_id: str
    email: str | None = None


class AuthorizedProfile(BaseModel):
    user_id: str
    agent_id: str
    display_name: str
    role: str
    clearance: str
    active: bool


app = FastAPI(
    title="CrimeLens Intelligence API",
    version="2.0.0",
)

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


def _database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization profile database is not configured",
        )
    return database_url


def require_supabase_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Security(bearer_scheme),
    ],
) -> AuthenticatedUser:
    """Validate a Supabase access token using the current Supabase SDK.

    `get_claims` verifies asymmetric tokens against the project's cached JWKS.
    The SDK safely falls back to the Auth service for legacy HS256 projects,
    without exposing the signing secret to this application.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if supabase_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase Auth validation is not configured",
        )

    try:
        response = supabase_client.auth.get_claims(credentials.credentials)
        claims = response.claims if response is not None else None
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase access token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    expected_issuer = f"{SUPABASE_URL.rstrip('/')}/auth/v1"
    audience = claims.get("aud") if claims else None
    audience_matches = (
        audience == "authenticated"
        or isinstance(audience, list)
        and "authenticated" in audience
    )
    user_id = claims.get("sub") if claims else None

    if (
        not isinstance(user_id, str)
        or not user_id
        or claims.get("iss") != expected_issuer
        or not audience_matches
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Supabase token claims are invalid",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = claims.get("email")
    return AuthenticatedUser(
        user_id=user_id,
        email=email if isinstance(email, str) else None,
    )


def _load_authorized_profile(user_id: str) -> AuthorizedProfile | None:
    try:
        with psycopg.connect(_database_url()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT user_id, agent_id, display_name, role, clearance, active
                    FROM public.profiles
                    WHERE user_id = %s
                    """,
                    (user_id,),
                )
                row = cursor.fetchone()
    except psycopg.Error as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization profile database is unavailable",
        ) from error

    if row is None:
        return None

    return AuthorizedProfile(
        user_id=str(row[0]),
        agent_id=row[1],
        display_name=row[2],
        role=row[3],
        clearance=row[4],
        active=row[5],
    )


def require_active_profile(
    user: Annotated[AuthenticatedUser, Depends(require_supabase_user)],
) -> AuthorizedProfile:
    profile = _load_authorized_profile(user.user_id)
    if profile is None or not profile.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active CrimeLens authorization profile required",
        )
    return profile


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "OK"}


@app.get("/api/v1/auth/me", response_model=AuthorizedProfile)
def get_current_profile(
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
) -> AuthorizedProfile:
    return profile


app.include_router(
    timeline_router,
    dependencies=[Depends(require_active_profile)],
)

app.include_router(build_pins_router(require_active_profile))
