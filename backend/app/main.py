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
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from psycopg.types.json import Jsonb
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat
from sklearn.svm import OneClassSVM
from supabase import Client, create_client


load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ADMIN_ACCESS_TOKEN = os.getenv("ADMIN_ACCESS_TOKEN")
PROVISION_TOKEN_EXPIRE_MINUTES = 15
PROVISION_TOKEN_ISSUER = "fatal_ledger_auth_system"
KINETIC_ENVELOPE_FACTOR = 2.5
MIN_GEOMETRY_THRESHOLD = 0.18
MAX_GEOMETRY_THRESHOLD = 0.26
KINETIC_SIGNATURE_VERSION = 2
MIN_SEQUENCE_PATH_LENGTH = 1.25
MIN_SEQUENCE_EXCURSION = 0.35
MAX_SEQUENCE_DTW_DISTANCE = 0.42
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


class KineticProfile(NamedTuple):
    samples: list[list[float]]
    clearance_status: str
    signature_version: int


app = FastAPI(
    title="Kinetic Authentication Service",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
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


def _sequence_features(samples: list[list[float]]) -> tuple[np.ndarray, float, float]:
    sequence = np.asarray(samples, dtype=np.float64)
    if sequence.shape != (10, 63):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Kinetic gesture must contain exactly 10 normalized frames",
        )

    smoothed = sequence.copy()
    smoothed[1:-1] = (
        sequence[:-2] + 2.0 * sequence[1:-1] + sequence[2:]
    ) / 4.0
    trajectory = smoothed - smoothed[0]
    step_lengths = np.linalg.norm(np.diff(trajectory, axis=0), axis=1)
    path_length = float(step_lengths.sum())
    excursion = float(np.linalg.norm(trajectory, axis=1).max())
    normalized = trajectory / max(excursion, np.finfo(np.float64).eps)
    return normalized, path_length, excursion


def _validate_enrollment_sequence(samples: list[list[float]]) -> None:
    _, path_length, excursion = _sequence_features(samples)
    if (
        path_length < MIN_SEQUENCE_PATH_LENGTH
        or excursion < MIN_SEQUENCE_EXCURSION
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Gesture is not distinctive enough. Re-enroll using a clear, "
                "private finger-motion sequence across all 10 captures."
            ),
        )


def _sequence_dtw_distance(
    enrolled_samples: list[list[float]],
    candidate_samples: list[list[float]],
) -> tuple[float, float, float]:
    enrolled, _, _ = _sequence_features(enrolled_samples)
    candidate, path_length, excursion = _sequence_features(candidate_samples)
    costs = np.full(
        (len(enrolled) + 1, len(candidate) + 1),
        np.inf,
        dtype=np.float64,
    )
    costs[0, 0] = 0.0

    for enrolled_index in range(1, len(enrolled) + 1):
        for candidate_index in range(1, len(candidate) + 1):
            frame_cost = np.linalg.norm(
                enrolled[enrolled_index - 1] - candidate[candidate_index - 1]
            )
            costs[enrolled_index, candidate_index] = frame_cost + min(
                costs[enrolled_index - 1, candidate_index],
                costs[enrolled_index, candidate_index - 1],
                costs[enrolled_index - 1, candidate_index - 1],
            )

    distance = float(costs[-1, -1] / max(len(enrolled), len(candidate)))
    return distance, path_length, excursion


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


@app.post(
    "/api/v1/auth/generate-provision-token",
    response_model=ProvisionTokenResponse,
)
def generate_provision_token(
    payload: ProvisionRequest,
    _admin_key: Annotated[str, Depends(verify_admin)],
) -> ProvisionTokenResponse:
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
    samples = [list(sample) for sample in payload.samples]
    _validate_enrollment_sequence(samples)
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
    sequence_distance, sequence_path_length, sequence_excursion = (
        _sequence_dtw_distance(profile.samples, candidate_samples)
    )
    sequence_match = (
        sequence_path_length >= MIN_SEQUENCE_PATH_LENGTH
        and sequence_excursion >= MIN_SEQUENCE_EXCURSION
        and sequence_distance <= MAX_SEQUENCE_DTW_DISTANCE
    )

    if prediction == -1 or not geometry_match or not sequence_match:
        logger.warning(
            "Biometric verification denied for agent=%s: "
            "svm_score=%.6f geometry_distance=%.6f geometry_threshold=%.6f "
            "sequence_distance=%.6f sequence_path=%.6f sequence_excursion=%.6f",
            payload.agent_id,
            float(model.decision_function(x_candidate)[0]),
            geometry_distance,
            geometry_threshold,
            sequence_distance,
            sequence_path_length,
            sequence_excursion,
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
