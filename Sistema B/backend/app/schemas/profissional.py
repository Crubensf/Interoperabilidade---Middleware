from typing import Any, Optional
import re
from pydantic import BaseModel, Field, EmailStr, field_validator


def only_digits(v: Any) -> str:
    if v is None:
        return ""
    return re.sub(r"\D+", "", str(v))


def normalize_phone(digits: str) -> str:
    # Remove DDI 55 se vier com 12 ou 13 dígitos iniciando com 55
    if len(digits) in (12, 13) and digits.startswith("55"):
        digits = digits[2:]
    return digits


class ProfissionalBase(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    especialidade_id: int

    crm: str | None = Field(default=None, max_length=20)
    crm_uf: str | None = Field(default=None, min_length=2, max_length=2)

    telefone: str | None = Field(default=None, min_length=10, max_length=11)
    email: EmailStr | None = None

    ativo: bool = True

    @field_validator("crm", mode="before")
    @classmethod
    def validar_crm(cls, v: Any) -> Any:
        if v is None:
            return v
        # CRM só números
        return only_digits(v)

    @field_validator("crm_uf")
    @classmethod
    def validar_uf(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) != 2:
            raise ValueError("crm_uf deve conter exatamente 2 caracteres.")
        return v.upper()

    @field_validator("telefone", mode="before")
    @classmethod
    def validar_telefone(cls, v: Any) -> Any:
        if v is None:
            return v
        digits = normalize_phone(only_digits(v))
        if len(digits) not in (10, 11):
            raise ValueError("telefone deve conter 10 ou 11 dígitos.")
        return digits


class ProfissionalCreate(ProfissionalBase):
    pass


class ProfissionalUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    especialidade_id: int | None = None

    crm: str | None = Field(default=None, max_length=20)
    crm_uf: str | None = Field(default=None, min_length=2, max_length=2)

    telefone: str | None = Field(default=None, min_length=10, max_length=11)
    email: EmailStr | None = None
    ativo: bool | None = None

    @field_validator("crm", mode="before")
    @classmethod
    def validar_crm_up(cls, v: Any) -> Any:
        if v is None:
            return v
        return only_digits(v)

    @field_validator("crm_uf")
    @classmethod
    def validar_uf_up(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) != 2:
            raise ValueError("crm_uf deve conter exatamente 2 caracteres.")
        return v.upper()

    @field_validator("telefone", mode="before")
    @classmethod
    def validar_telefone_up(cls, v: Any) -> Any:
        if v is None:
            return v
        digits = normalize_phone(only_digits(v))
        if len(digits) not in (10, 11):
            raise ValueError("telefone deve conter 10 ou 11 dígitos.")
        return digits


class ProfissionalOut(BaseModel):
    id: int
    nome: str
    especialidade_id: int

    crm: str | None = None
    crm_uf: str | None = None
    telefone: str | None = None
    email: EmailStr | None = None
    ativo: bool

    class Config:
        from_attributes = True
