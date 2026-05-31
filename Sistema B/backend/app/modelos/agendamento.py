from sqlalchemy import DateTime, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Agendamento(Base):
    __tablename__ = "agendamentos"

    __table_args__ = (
        UniqueConstraint("profissional_id", "inicio", name="uq_profissional_inicio"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    paciente_id: Mapped[int] = mapped_column(ForeignKey("pacientes.id"))
    profissional_id: Mapped[int] = mapped_column(ForeignKey("profissionais.id"))
    especialidade_id: Mapped[int] = mapped_column(ForeignKey("especialidades.id"))
    local_id: Mapped[int] = mapped_column(ForeignKey("locais_atendimento.id"))

    inicio: Mapped["DateTime"] = mapped_column(DateTime(timezone=False), index=True)
    modalidade: Mapped[str] = mapped_column(String(20), default="PRESENCIAL")
    status: Mapped[str] = mapped_column(String(20), default="agendado")

    criado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    criado_por = relationship("Usuario")

    paciente = relationship("Paciente")
    profissional = relationship("Profissional")
    especialidade = relationship("Especialidade")
    local = relationship("LocalAtendimento")
