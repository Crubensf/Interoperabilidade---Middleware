from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class LocalAtendimento(Base):
    __tablename__ = "locais_atendimento"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String(140), index=True)
    municipio: Mapped[str] = mapped_column(String(120))
    endereco: Mapped[str] = mapped_column(String(200))
