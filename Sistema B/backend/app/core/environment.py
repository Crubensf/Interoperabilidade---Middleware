
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    API_TITLE: str = "PET Saúde"
    ENV: str = "dev"
    CORS_ORIGINS: str = "http://localhost:5173"
    DATABASE_URL: str

    
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Usuário admin criado automaticamente no primeiro boot, se não existir.
    # Necessário para o middleware autenticar (ele faz login com essas credenciais).
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_SENHA: str = "trocar_aqui"
    ADMIN_NOME: str = "Admin"

    MIDDLEWARE_BASE_URL: str | None = None
    MIDDLEWARE_API_KEY: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
