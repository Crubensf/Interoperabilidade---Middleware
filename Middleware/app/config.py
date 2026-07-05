from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    SISTEMA_A_BASE_URL: str = "http://localhost:5050"
    SISTEMA_A_API_KEY: str = ""
    SISTEMA_B_BASE_URL: str = "http://localhost:8000"
    SISTEMA_B_API_KEY: str = ""

    SISTEMA_B_EMAIL: str = ""
    SISTEMA_B_SENHA: str = ""

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/middleware"
    MIDDLEWARE_PORT: int = 8080
    HTTP_TIMEOUT: float = 15.0
    CORS_ORIGINS: str = "http://localhost:8080,http://127.0.0.1:8080"
    SHADOW_PERSIST_READS: bool = True


settings = Settings()
