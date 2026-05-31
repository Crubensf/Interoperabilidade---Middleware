from pydantic import BaseModel, Field


class EspecialidadeBase(BaseModel):
    codigo: str = Field(min_length=2, max_length=80)
    nome: str = Field(min_length=2, max_length=120)
    permite_telemedicina: bool = False


class EspecialidadeCreate(EspecialidadeBase):
    pass


class EspecialidadeUpdate(BaseModel):
    codigo: str | None = Field(default=None, min_length=2, max_length=80)
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    permite_telemedicina: bool | None = None


class EspecialidadeOut(EspecialidadeBase):
    id: int

    class Config:
        from_attributes = True
