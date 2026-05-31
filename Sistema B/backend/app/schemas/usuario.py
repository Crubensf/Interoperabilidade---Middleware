
from pydantic import BaseModel, EmailStr, Field


class UsuarioCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=140)
    email: EmailStr
    senha: str = Field(min_length=6, max_length=128)
    is_admin: bool = False


class UsuarioOut(BaseModel):
    id: int
    nome: str
    email: EmailStr
    is_admin: bool

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
