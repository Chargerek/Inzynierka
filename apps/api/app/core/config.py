from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Inzynierka API"
    cors_origins: str = "http://localhost:3000"
    database_url: str = (
        "postgresql+psycopg://inzynierka:inzynierka@localhost:5432/inzynierka"
    )
    jwt_secret_key: str = "zmien-to-w-env-lokalnym"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    uploads_dir: str = "uploads"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
