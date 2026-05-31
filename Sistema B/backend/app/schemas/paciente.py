from __future__ import annotations

import re
from datetime import date
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator
from pydantic.config import ConfigDict


def only_digits(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\D+", "", str(value))


def normalize_phone(digits: str) -> str:
    # remove 55 se vier junto (Brasil)
    if len(digits) in (12, 13) and digits.startswith("55"):
        digits = digits[2:]
    return digits


class PacienteBase(BaseModel):
    nome: str = Field(min_length=2, max_length=140)

    cpf: str = Field(min_length=11, max_length=11)

    cartao_sus: Optional[str] = Field(default=None, min_length=15, max_length=15)

    telefone: str = Field(min_length=10, max_length=11)

    data_nascimento: date
    municipio: str = Field(min_length=2, max_length=120)
    endereco: str = Field(min_length=2, max_length=200)
    nome_mae: str = Field(min_length=2, max_length=140)

    # ---------- CPF ----------
    @field_validator("cpf", mode="before")
    @classmethod
    def validar_cpf(cls, v: Any) -> str:
        digits = only_digits(v)
        if len(digits) != 11:
            raise ValueError("cpf deve conter exatamente 11 dígitos.")
        return digits

    # ---------- CNS ----------
    @field_validator("cartao_sus", mode="before")
    @classmethod
    def validar_cns(cls, v: Any) -> Optional[str]:
        if v in (None, ""):
            return None
        digits = only_digits(v)
        if len(digits) != 15:
            raise ValueError("cartao_sus deve conter exatamente 15 dígitos.")
        return digits

    # ---------- TELEFONE ----------
    @field_validator("telefone", mode="before")
    @classmethod
    def validar_telefone(cls, v: Any) -> str:
        digits = normalize_phone(only_digits(v))
        if len(digits) not in (10, 11):
            raise ValueError("telefone deve conter 10 ou 11 dígitos (DDD + número).")
        return digits

    # ---------- DATA ----------
    @field_validator("data_nascimento")
    @classmethod
    def validar_data_nascimento(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("data_nascimento não pode ser no futuro.")
        return v


class PacienteCreate(PacienteBase):
    pass


class PacienteUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=2, max_length=140)
    cpf: Optional[str] = Field(default=None, min_length=11, max_length=11)
    cartao_sus: Optional[str] = Field(default=None, min_length=15, max_length=15)
    telefone: Optional[str] = Field(default=None, min_length=10, max_length=11)
    data_nascimento: Optional[date] = None
    municipio: Optional[str] = Field(default=None, min_length=2, max_length=120)
    endereco: Optional[str] = Field(default=None, min_length=2, max_length=200)
    nome_mae: Optional[str] = Field(default=None, min_length=2, max_length=140)

    @field_validator("cpf", mode="before")
    @classmethod
    def validar_cpf_update(cls, v: Any) -> Any:
        if v is None:
            return v
        digits = only_digits(v)
        if len(digits) != 11:
            raise ValueError("cpf deve conter exatamente 11 dígitos.")
        return digits

    @field_validator("cartao_sus", mode="before")
    @classmethod
    def validar_cns_update(cls, v: Any) -> Any:
        if v in (None, ""):
            return None
        digits = only_digits(v)
        if len(digits) != 15:
            raise ValueError("cartao_sus deve conter exatamente 15 dígitos.")
        return digits

    @field_validator("telefone", mode="before")
    @classmethod
    def validar_telefone_update(cls, v: Any) -> Any:
        if v is None:
            return v
        digits = normalize_phone(only_digits(v))
        if len(digits) not in (10, 11):
            raise ValueError("telefone deve conter 10 ou 11 dígitos (DDD + número).")
        return digits

    @field_validator("data_nascimento")
    @classmethod
    def validar_data_nascimento_update(cls, v: Optional[date]) -> Optional[date]:
        if v is None:
            return v
        if v > date.today():
            raise ValueError("data_nascimento não pode ser no futuro.")
        return v


class PacienteOut(PacienteBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
