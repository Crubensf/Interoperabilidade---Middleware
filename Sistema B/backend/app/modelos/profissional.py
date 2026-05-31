from sqlalchemy import String, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Profissional(Base):
    __tablename__ = "profissionais"

    __table_args__ = (
        UniqueConstraint("crm", "crm_uf", name="uq_profissional_crm"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    nome: Mapped[str] = mapped_column(String(120), index=True, nullable=False)

    especialidade_id: Mapped[int] = mapped_column(
        ForeignKey("especialidades.id"),
        nullable=False,
    )
    especialidade = relationship("Especialidade")

    
    crm: Mapped[str | None] = mapped_column(String(20), nullable=True)
    crm_uf: Mapped[str | None] = mapped_column(String(2), nullable=True)

    telefone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(140), nullable=True)

    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
