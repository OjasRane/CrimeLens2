from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed backend configuration loaded from process environment variables."""

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    database_url: str | None = None
    supabase_url: str | None = None
    supabase_service_role_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"),
    )
    supabase_jwks_url: str | None = None
    supabase_jwt_issuer: str | None = None
    supabase_jwt_audience: str = "authenticated"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    historical_cache_seconds: int = Field(default=300, ge=0, le=86_400)
    rate_limit_per_minute: int = Field(default=180, ge=10, le=10_000)
    openai_api_key: str | None = None
    openai_model: str = "gpt-5.6-luna"
    openai_timeout_seconds: float = Field(default=20, ge=1, le=120)
    max_upload_mb: int = Field(default=15, ge=1, le=100)
    evidence_storage_dir: str = "backend/.data/evidence"
    allowed_evidence_mime_types: str = (
        "application/pdf,text/plain,text/csv,application/csv,application/json,"
        "image/jpeg,image/png"
    )
    docs_enabled: bool | None = None
    port: int = Field(default=8000, ge=1, le=65_535)

    @property
    def jwt_issuer(self) -> str:
        if self.supabase_jwt_issuer:
            return self.supabase_jwt_issuer.rstrip("/")
        if not self.supabase_url:
            return ""
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def jwks_url(self) -> str:
        if self.supabase_jwks_url:
            return self.supabase_jwks_url
        if not self.supabase_url:
            return ""
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def expose_docs(self) -> bool:
        if self.docs_enabled is not None:
            return self.docs_enabled
        return self.environment != "production"

    @property
    def evidence_mime_types(self) -> set[str]:
        return {item.strip().lower() for item in self.allowed_evidence_mime_types.split(",") if item.strip()}

    def validate_runtime(self) -> None:
        """Fail startup before serving traffic when mandatory services are absent."""
        if self.environment == "test":
            return
        missing: list[str] = []
        if not self.database_url:
            missing.append("DATABASE_URL")
        if not self.supabase_url:
            missing.append("SUPABASE_URL")
        if missing:
            raise RuntimeError(
                "CrimeLens API configuration is incomplete: " + ", ".join(missing)
            )
        if not self.allowed_origins:
            raise RuntimeError("CORS_ORIGINS must include at least one trusted frontend origin")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
