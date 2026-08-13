from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Annotated, NamedTuple

import jwt
import numpy as np
import psycopg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Security, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security.api_key import APIKeyHeader
from fastapi.security.http import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat
from sklearn.svm import OneClassSVM
from supabase import Client, create_client

from .timeline_router import router as timeline_router


load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ADMIN_ACCESS_TOKEN = os.getenv("ADMIN_ACCESS_TOKEN")
LEGACY_KINETIC_AUTH_ENABLED = (
    os.getenv("ENABLE_LEGACY_KINETIC_AUTH", "false").lower() == "true"
)
PROVISION_TOKEN_EXPIRE_MINUTES = 15
PROVISION_TOKEN_ISSUER = "fatal_ledger_auth_system"
KINETIC_ENVELOPE_FACTOR = 1.75
MIN_GEOMETRY_THRESHOLD = 0.18
MAX_GEOMETRY_THRESHOLD = 0.26
KINETIC_SIGNATURE_VERSION = 2
MIN_STATIC_POSE_THRESHOLD = 0.30
MAX_STATIC_POSE_THRESHOLD = 0.70
HAND_BONE_CONNECTIONS = (
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (0, 17), (17, 18), (18, 19), (19, 20),
)

logger = logging.getLogger(__name__)
supabase_client: Client | None = (
    create_client(SUPABASE_URL, SUPABASE_KEY)
    if SUPABASE_URL and SUPABASE_KEY
    else None
)
admin_api_key_header = APIKeyHeader(name="X-Admin-Token", auto_error=False)
bearer_scheme = HTTPBearer(auto_error=False)


Vector63 = Annotated[list[FiniteFloat], Field(min_length=63, max_length=63)]
EnrollmentSamples = Annotated[list[Vector63], Field(min_length=10, max_length=10)]


class RegistrationPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    provisioning_token: Annotated[str, Field(min_length=1)]
    samples: EnrollmentSamples


class ProvisionRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    admin_id: Annotated[str, Field(min_length=1, max_length=50)]
    new_agent_id: Annotated[str, Field(min_length=1, max_length=50)]


class VerificationPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    agent_id: Annotated[str, Field(min_length=1, max_length=50)]
    candidate_samples: EnrollmentSamples


class RegistrationResponse(BaseModel):
    status: str


class ProvisionTokenResponse(BaseModel):
    status: str
    expires_in_minutes: int
    provisioning_token: str


class VerificationResponse(BaseModel):
    status: str
    access_token: str


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


class KineticProfile(NamedTuple):
    samples: list[list[float]]
    clearance_status: str
    signature_version: int


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
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Admin-Token"],
)

_models: dict[str, OneClassSVM] = {}
_model_lock = RLock()


def _database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Biometric signature database is not configured",
        )
    return database_url


def _jwt_secret() -> str:
    if not JWT_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="JWT signing key is not configured",
        )
    return JWT_SECRET_KEY


async def verify_admin(
    api_key: Annotated[str | None, Security(admin_api_key_header)],
) -> str:
    if not ADMIN_ACCESS_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin access token is not configured",
        )

    if api_key is None or not secrets.compare_digest(api_key, ADMIN_ACCESS_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Invalid Admin Token",
        )
    return api_key


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
        or isinstance(audience, list) and "authenticated" in audience
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


def require_legacy_kinetic_auth() -> None:
    if not LEGACY_KINETIC_AUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=(
                "Legacy kinetic authentication is disabled. "
                "Use Supabase passkey authentication."
            ),
        )


def _create_access_token(agent_id: str, clearance_status: str) -> str:
    now = datetime.now(timezone.utc)
    expires_in_minutes = int(os.getenv("JWT_EXPIRE_MINUTES", "30"))
    claims = {
        "sub": agent_id,
        "agent_id": agent_id,
        "clearance_status": clearance_status,
        "iat": now,
        "exp": now + timedelta(minutes=expires_in_minutes),
        "iss": "fatal-kinetic-auth",
    }
    return jwt.encode(claims, _jwt_secret(), algorithm="HS256")


def _create_provisioning_token(agent_id: str) -> tuple[str, datetime]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=PROVISION_TOKEN_EXPIRE_MINUTES)
    claims = {
        "sub": agent_id,
        "exp": expires_at,
        "iss": PROVISION_TOKEN_ISSUER,
    }
    encoded_token = jwt.encode(claims, _jwt_secret(), algorithm="HS256")
    return encoded_token, expires_at


def _decode_provisioning_token(encoded_token: str) -> str:
    try:
        claims = jwt.decode(
            encoded_token,
            _jwt_secret(),
            algorithms=["HS256"],
            issuer=PROVISION_TOKEN_ISSUER,
            options={"require": ["sub", "exp", "iss"]},
        )
    except ExpiredSignatureError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Provisioning token expired",
        ) from error
    except InvalidTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid provisioning token",
        ) from error

    agent_id = claims.get("sub")
    if not isinstance(agent_id, str) or not agent_id or len(agent_id) > 50:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid provisioning token claims",
        )
    return agent_id


def _train_model(samples: list[list[float]]) -> OneClassSVM:
    x_train = np.asarray(samples, dtype=np.float64)
    if x_train.ndim != 2 or x_train.shape[1] != 63:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enrollment samples must have shape N x 63",
        )

    # Five raw MediaPipe frames occupy an extremely thin region in 63-D space.
    # A vanilla One-Class SVM consequently places even its training points on
    # the decision boundary and rejects normal frame-to-frame sensor noise.
    # Expand the training set deterministically along the observed principal
    # motion axes so the model retains an anomaly boundary with usable margin.
    centroid = x_train.mean(axis=0)
    centered = x_train - centroid
    _, singular_values, principal_axes = np.linalg.svd(
        centered,
        full_matrices=False,
    )
    augmented_samples = [*x_train, centroid]
    scale_denominator = np.sqrt(max(1, len(x_train) - 1))

    for singular_value, axis in zip(singular_values, principal_axes):
        if singular_value <= np.finfo(np.float64).eps:
            continue
        displacement = (
            axis
            * singular_value
            / scale_denominator
            * KINETIC_ENVELOPE_FACTOR
        )
        augmented_samples.extend(
            [centroid + displacement, centroid - displacement]
        )

    x_augmented = np.asarray(augmented_samples, dtype=np.float64)
    model = OneClassSVM(kernel="rbf", gamma="scale", nu=0.05)
    model.fit(x_augmented)
    return model


def _hand_geometry(vector: list[float] | np.ndarray) -> np.ndarray:
    landmarks = np.asarray(vector, dtype=np.float64).reshape(21, 3)
    return np.asarray(
        [
            np.linalg.norm(landmarks[end] - landmarks[start])
            for start, end in HAND_BONE_CONNECTIONS
        ],
        dtype=np.float64,
    )


def _geometry_match_metrics(
    samples: list[list[float]],
    candidate: list[float],
) -> tuple[bool, float, float]:
    enrolled_geometry = np.asarray(
        [_hand_geometry(sample) for sample in samples],
        dtype=np.float64,
    )
    geometry_center = np.median(enrolled_geometry, axis=0)
    enrollment_distances = np.linalg.norm(
        enrolled_geometry - geometry_center,
        axis=1,
    )
    median_distance = float(np.median(enrollment_distances))
    median_absolute_deviation = float(
        np.median(np.abs(enrollment_distances - median_distance))
    )

    # The robust enrollment radius ignores a single unstable capture while
    # the hard ceiling prevents an unusually noisy enrollment from widening
    # the identity gate enough to admit a different hand.
    geometry_threshold = min(
        MAX_GEOMETRY_THRESHOLD,
        max(
            MIN_GEOMETRY_THRESHOLD,
            median_distance + 3.0 * median_absolute_deviation,
        ),
    )
    candidate_distance = float(
        np.linalg.norm(_hand_geometry(candidate) - geometry_center)
    )
    return (
        candidate_distance <= geometry_threshold,
        candidate_distance,
        geometry_threshold,
    )


def _static_pose_match_metrics(
    enrolled_samples: list[list[float]],
    candidate_samples: list[list[float]],
) -> tuple[bool, float, float, float]:
    enrolled = np.asarray(enrolled_samples, dtype=np.float64)
    candidate = np.asarray(candidate_samples, dtype=np.float64)
    enrolled_center = np.median(enrolled, axis=0)
    candidate_center = np.median(candidate, axis=0)
    enrollment_distances = np.linalg.norm(
        enrolled - enrolled_center,
        axis=1,
    )
    median_distance = float(np.median(enrollment_distances))
    median_absolute_deviation = float(
        np.median(np.abs(enrollment_distances - median_distance))
    )
    threshold = min(
        MAX_STATIC_POSE_THRESHOLD,
        max(
            MIN_STATIC_POSE_THRESHOLD,
            median_distance + 4.0 * median_absolute_deviation,
        ),
    )
    pose_distance = float(np.linalg.norm(candidate_center - enrolled_center))
    candidate_jitter = float(
        np.median(np.linalg.norm(candidate - candidate_center, axis=1))
    )
    return pose_distance <= threshold, pose_distance, threshold, candidate_jitter


def _consume_token_and_store_signatures(
    encoded_token: str,
    agent_id: str,
    samples: list[list[float]],
) -> None:
    try:
        with psycopg.connect(_database_url()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT agent_id, expires_at, is_burned
                    FROM provisioning_tokens
                    WHERE token_string = %s
                    FOR UPDATE
                    """,
                    (encoded_token,),
                )
                token_row = cursor.fetchone()

                if token_row is None or token_row[0] != agent_id:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Provisioning token is not registered",
                    )
                if token_row[2]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Provisioning token has already been burned",
                    )
                if token_row[1] <= datetime.now(timezone.utc):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Provisioning token expired",
                    )

                cursor.execute(
                    """
                    INSERT INTO agents (agent_id)
                    VALUES (%s)
                    ON CONFLICT (agent_id) DO NOTHING
                    """,
                    (agent_id,),
                )
                cursor.execute(
                    "DELETE FROM kinetic_signatures WHERE agent_id = %s",
                    (agent_id,),
                )
                cursor.executemany(
                    """
                    INSERT INTO kinetic_signatures (
                        agent_id,
                        signature_vector,
                        signature_version
                    )
                    VALUES (%s, %s, %s)
                    """,
                    [
                        (agent_id, Jsonb(sample), KINETIC_SIGNATURE_VERSION)
                        for sample in samples
                    ],
                )
                cursor.execute(
                    """
                    UPDATE provisioning_tokens
                    SET is_burned = TRUE
                    WHERE token_string = %s AND is_burned = FALSE
                    """,
                    (encoded_token,),
                )
                if cursor.rowcount != 1:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Provisioning token has already been burned",
                    )
    except psycopg.Error as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Biometric signature database is unavailable",
        ) from error


def _load_profile(agent_id: str) -> KineticProfile | None:
    try:
        with psycopg.connect(_database_url()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        ks.signature_vector,
                        a.clearance_level,
                        ks.signature_version
                    FROM agents AS a
                    JOIN kinetic_signatures AS ks
                        ON ks.agent_id = a.agent_id
                    WHERE a.agent_id = %s
                    ORDER BY ks.created_at ASC, ks.id ASC
                    """,
                    (agent_id,),
                )
                rows = cursor.fetchall()
                if not rows:
                    return None
                return KineticProfile(
                    samples=[row[0] for row in rows],
                    clearance_status=rows[0][1],
                    signature_version=rows[0][2],
                )
    except psycopg.Error as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Biometric signature database is unavailable",
        ) from error


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "OK"}


@app.get("/api/v1/auth/me", response_model=AuthorizedProfile)
def get_current_profile(
    profile: Annotated[AuthorizedProfile, Depends(require_active_profile)],
) -> AuthorizedProfile:
    return profile


@app.post(
    "/api/v1/auth/generate-provision-token",
    response_model=ProvisionTokenResponse,
)
def generate_provision_token(
    payload: ProvisionRequest,
    _admin_key: Annotated[str, Depends(verify_admin)],
) -> ProvisionTokenResponse:
    require_legacy_kinetic_auth()
    encoded_token, expires_at = _create_provisioning_token(payload.new_agent_id)

    if supabase_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase client is not configured",
        )

    try:
        (
            supabase_client.table("provisioning_tokens")
            .insert(
                {
                    "token_string": encoded_token,
                    "agent_id": payload.new_agent_id,
                    "expires_at": expires_at.isoformat(),
                    "is_burned": False,
                }
            )
            .execute()
        )
    except Exception as error:
        logger.exception(
            "Provisioning token persistence failed for admin=%s agent=%s",
            payload.admin_id,
            payload.new_agent_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist provisioning token",
        ) from error

    logger.info(
        "Provisioning token generated by admin=%s for agent=%s; expires_at=%s",
        payload.admin_id,
        payload.new_agent_id,
        expires_at.isoformat(),
    )
    return ProvisionTokenResponse(
        status="TOKEN_GENERATED",
        expires_in_minutes=PROVISION_TOKEN_EXPIRE_MINUTES,
        provisioning_token=encoded_token,
    )


@app.post(
    "/api/v1/auth/register-kinetic",
    response_model=RegistrationResponse,
)
def register_kinetic(payload: RegistrationPayload) -> RegistrationResponse:
    require_legacy_kinetic_auth()
    samples = [list(sample) for sample in payload.samples]
    model = _train_model(samples)
    agent_id = _decode_provisioning_token(payload.provisioning_token)
    _consume_token_and_store_signatures(
        encoded_token=payload.provisioning_token,
        agent_id=agent_id,
        samples=samples,
    )

    with _model_lock:
        _models[agent_id] = model

    return RegistrationResponse(status="SUCCESS")


@app.post(
    "/api/v1/auth/verify-kinetic",
    response_model=VerificationResponse,
)
def verify_kinetic(payload: VerificationPayload) -> VerificationResponse:
    require_legacy_kinetic_auth()
    # Signature vectors are the durable source of truth. Rebuilding the model
    # here keeps separate FastAPI instances consistent after re-enrollment.
    profile = _load_profile(payload.agent_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kinetic signature not registered for this agent",
        )

    if profile.signature_version != KINETIC_SIGNATURE_VERSION:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Legacy static baseline cannot provide identity separation. "
                "Re-enroll this agent with a private kinetic gesture."
            ),
        )

    model = _train_model(profile.samples)
    with _model_lock:
        _models[payload.agent_id] = model

    candidate_samples = [list(sample) for sample in payload.candidate_samples]
    candidate_vector = np.asarray(candidate_samples, dtype=np.float64).mean(axis=0)
    x_candidate = candidate_vector.reshape(1, 63)
    prediction = int(model.predict(x_candidate)[0])
    geometry_match, geometry_distance, geometry_threshold = (
        _geometry_match_metrics(
        profile.samples,
        candidate_vector.tolist(),
        )
    )
    pose_match, pose_distance, pose_threshold, candidate_jitter = (
        _static_pose_match_metrics(profile.samples, candidate_samples)
    )

    if prediction == -1 or not geometry_match or not pose_match:
        logger.warning(
            "Biometric verification denied for agent=%s: "
            "svm_score=%.6f geometry_distance=%.6f geometry_threshold=%.6f "
            "pose_distance=%.6f pose_threshold=%.6f candidate_jitter=%.6f",
            payload.agent_id,
            float(model.decision_function(x_candidate)[0]),
            geometry_distance,
            geometry_threshold,
            pose_distance,
            pose_threshold,
            candidate_jitter,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Biometric Anomaly Detected",
        )

    return VerificationResponse(
        status="VERIFIED",
        access_token=_create_access_token(
            agent_id=payload.agent_id,
            clearance_status=profile.clearance_status,
        ),
    )


# Investigation routes accept only a verified Supabase session whose subject
# also has an active server-controlled CrimeLens authorization profile.
app.include_router(
    timeline_router,
    dependencies=[Depends(require_active_profile)],
)
