from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Inzynierka API"
    cors_origins: str = "http://localhost:3000"
    database_url: str = (
        "postgresql+psycopg://inzynierka:inzynierka@localhost:5432/inzynierka"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
