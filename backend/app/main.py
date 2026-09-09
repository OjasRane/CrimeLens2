from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from .api.routes import audit, auth, evidence, health, investigations, workspaces
from .api.dependencies import require_active_profile
from .core.config import Settings, get_settings
from .core.observability import LocalRateLimitMiddleware, RequestContextMiddleware
from .core.security import SupabaseJwtVerifier
from .pins_router import build_pins_router
from .services.repository import (
    InvestigationRepository,
    MemoryInvestigationRepository,
    PostgresInvestigationRepository,
)
from .services.evidence_repository import build_evidence_repository
from .timeline_router import router as blind_spot_router


logger = logging.getLogger("crimelens.api")


def _default_repository(settings: Settings) -> InvestigationRepository:
    if settings.database_url:
        return PostgresInvestigationRepository(settings.database_url)
    return MemoryInvestigationRepository.from_seed_file()


def create_app(
    *,
    settings: Settings | None = None,
    repository: InvestigationRepository | None = None,
    jwt_verifier: Any | None = None,
) -> FastAPI:
    active_settings = settings or get_settings()
    active_repository = repository or _default_repository(active_settings)
    active_verifier = jwt_verifier or SupabaseJwtVerifier(active_settings)

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        active_settings.validate_runtime()
        if not active_repository.ready():
            raise RuntimeError("CrimeLens investigation database is not ready")
        logger.info(
            json.dumps(
                {
                    "event": "crimelens_api_started",
                    "environment": active_settings.environment,
                    "database_ready": True,
                    "auth_configuration_ready": bool(active_settings.jwks_url),
                },
                separators=(",", ":"),
            )
        )
        yield

    application = FastAPI(
        title="CrimeLens Intelligence API",
        version="3.0.0",
        lifespan=lifespan,
        docs_url="/docs" if active_settings.expose_docs else None,
        redoc_url="/redoc" if active_settings.expose_docs else None,
        openapi_url="/openapi.json" if active_settings.expose_docs else None,
    )
    application.state.settings = active_settings
    application.state.repository = active_repository
    application.state.evidence_repository = build_evidence_repository(active_repository)
    application.state.jwt_verifier = active_verifier

    application.add_middleware(GZipMiddleware, minimum_size=1_000)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-Total-Count", "ETag"],
    )
    application.add_middleware(
        LocalRateLimitMiddleware,
        requests_per_minute=active_settings.rate_limit_per_minute,
    )
    application.add_middleware(RequestContextMiddleware)

    @application.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException) -> JSONResponse:
        detail = error.detail if isinstance(error.detail, dict) else {}
        fallback_codes = {
            400: "BAD_REQUEST",
            401: "AUTHENTICATION_REQUIRED",
            403: "ACCESS_DENIED",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
            429: "RATE_LIMITED",
            503: "SERVICE_UNAVAILABLE",
        }
        body = {
            "error": {
                "code": detail.get("code", fallback_codes.get(error.status_code, "REQUEST_FAILED")),
                "message": detail.get("message", "The CrimeLens request could not be completed."),
                "requestId": getattr(request.state, "request_id", None),
            }
        }
        return JSONResponse(status_code=error.status_code, content=body, headers=error.headers)

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, _error: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "The request parameters or payload are invalid.",
                    "requestId": getattr(request.state, "request_id", None),
                }
            },
        )

    @application.exception_handler(Exception)
    async def internal_error(request: Request, error: Exception) -> JSONResponse:
        logger.exception(
            "unhandled_api_error",
            extra={"request_id": getattr(request.state, "request_id", None)},
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "The CrimeLens service encountered an internal error.",
                    "requestId": getattr(request.state, "request_id", None),
                }
            },
        )

    application.include_router(health.router)
    application.include_router(auth.router)
    application.include_router(investigations.router)
    application.include_router(evidence.router)
    application.include_router(workspaces.router)
    application.include_router(audit.router)
    application.include_router(
        blind_spot_router,
        dependencies=[Depends(require_active_profile)],
    )
    application.include_router(build_pins_router())
    return application


app = create_app()
