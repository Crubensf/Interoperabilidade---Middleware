from pydantic import BaseModel, Field


class LocalBase(BaseModel):
    nome: str = Field(min_length=2, max_length=140)
    municipio: str = Field(min_length=2, max_length=120)
    endereco: str = Field(min_length=2, max_length=200)


class LocalCreate(LocalBase):
    pass


class LocalUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=140)
    municipio: str | None = Field(default=None, min_length=2, max_length=120)
    endereco: str | None = Field(default=None, min_length=2, max_length=200)


class LocalOut(LocalBase):
    id: int

    class Config:
        from_attributes = True
