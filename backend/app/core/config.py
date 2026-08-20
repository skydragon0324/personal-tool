from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://todo:todo@localhost:5432/daily_todo"
    test_database_url: str | None = None
    cors_origins: str = "http://localhost:3000"
    upload_dir: str = "uploads"
    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MB
    public_base_url: str = "http://localhost:8000"
    environment: str = "development"
    session_cookie_name: str = "life_session"
    csrf_cookie_name: str = "life_csrf"
    csrf_header_name: str = "X-CSRF-Token"
    session_ttl_days: int = 30
    cookie_secure: bool | None = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def use_secure_cookies(self) -> bool:
        if self.cookie_secure is not None:
            return self.cookie_secure
        return self.environment.lower() == "production"

    @property
    def session_max_age_seconds(self) -> int:
        return self.session_ttl_days * 24 * 60 * 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
