from datetime import datetime, time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.security import get_current_user  

from app.modelos.agendamento import Agendamento
from app.modelos.paciente import Paciente
from app.modelos.profissional import Profissional
from app.modelos.especialidade import Especialidade
from app.modelos.local_atendimento import LocalAtendimento
from app.modelos.usuario import Usuario

from app.schemas.agendamento import (
    AgendamentoCreate,
    AgendamentoOut,
    AgendamentoUpdate,
)

router = APIRouter(
    prefix="/api/agendamentos",
    tags=["Agendamentos"],
    dependencies=[Depends(get_current_user)],  
)

ALLOWED_STATUS = {"agendado", "cancelado", "atendido"}


# VALIDADORES INTERNOS


def _validar_fk(payload: dict, db: Session):
    if (pid := payload.get("paciente_id")) is not None:
        if not db.get(Paciente, pid):
            raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    if (prof_id := payload.get("profissional_id")) is not None:
        if not db.get(Profissional, prof_id):
            raise HTTPException(status_code=404, detail="Profissional não encontrado.")

    if (esp_id := payload.get("especialidade_id")) is not None:
        if not db.get(Especialidade, esp_id):
            raise HTTPException(status_code=404, detail="Especialidade não encontrada.")

    if (loc_id := payload.get("local_id")) is not None:
        if not db.get(LocalAtendimento, loc_id):
            raise HTTPException(status_code=404, detail="Local não encontrado.")


def _validar_conflito(
    profissional_id: int,
    inicio,
    db: Session,
    ignore_id: int | None = None,
):
    stmt = select(Agendamento).where(
        and_(
            Agendamento.profissional_id == profissional_id,
            Agendamento.inicio == inicio,
        )
    )

    if ignore_id is not None:
        stmt = stmt.where(Agendamento.id != ignore_id)

    exists = db.scalar(stmt)
    if exists:
        raise HTTPException(
            status_code=409,
            detail="Conflito: já existe agendamento neste horário para o profissional.",
        )


def _validar_telemedicina(
    especialidade_id: int,
    modalidade: str,
    db: Session,
):
    if modalidade != "TELEMEDICINA":
        return

    esp = db.get(Especialidade, especialidade_id)
    if not esp:
        raise HTTPException(status_code=404, detail="Especialidade não encontrada.")

    if not esp.permite_telemedicina:
        raise HTTPException(
            status_code=400,
            detail="Esta especialidade não permite telemedicina.",
        )



# ROTAS


@router.post("", response_model=AgendamentoOut, status_code=status.HTTP_201_CREATED)
def criar(
    payload: AgendamentoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    data = payload.model_dump()
    data["status"] = "agendado"
    data["criado_por_id"] = user.id  

    _validar_fk(data, db)
    _validar_telemedicina(data["especialidade_id"], data["modalidade"], db)
    _validar_conflito(data["profissional_id"], data["inicio"], db)

    obj = Agendamento(**data)
    db.add(obj)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Conflito: agendamento já existe para este horário/profissional.",
        )

    db.refresh(obj)
    return obj


@router.get("", response_model=list[AgendamentoOut])
def listar(db: Session = Depends(get_db)):
    stmt = select(Agendamento).order_by(Agendamento.inicio.desc())
    return list(db.scalars(stmt).all())


@router.get("/hoje", response_model=list[AgendamentoOut])
def listar_hoje(db: Session = Depends(get_db)):
    hoje = datetime.now().date()

    inicio_dia = datetime.combine(hoje, time.min)
    fim_dia = datetime.combine(hoje, time.max)

    ags = (
        db.query(Agendamento)
        .options(
            joinedload(Agendamento.paciente),
            joinedload(Agendamento.profissional),
            joinedload(Agendamento.especialidade),
        )
        .filter(
            Agendamento.inicio >= inicio_dia,
            Agendamento.inicio <= fim_dia,
            Agendamento.status == "agendado",
        )
        .order_by(Agendamento.inicio.asc())
        .all()
    )

    # 🔥 Monta resposta manualmente
    resultado = []
    for ag in ags:
        resultado.append(
            AgendamentoOut(
                id=ag.id,
                inicio=ag.inicio,
                status=ag.status,
                paciente_id=ag.paciente_id,
                profissional_id=ag.profissional_id,
                especialidade_id=ag.especialidade_id,
                local_id=ag.local_id,
                paciente_nome=ag.paciente.nome if ag.paciente else None,
                profissional_nome=ag.profissional.nome if ag.profissional else None,
                especialidade_nome=ag.especialidade.nome if ag.especialidade else None,
            )
        )

    return resultado

@router.get("/{agendamento_id}", response_model=AgendamentoOut)
def detalhar(agendamento_id: int, db: Session = Depends(get_db)):
    obj = db.get(Agendamento, agendamento_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
    return obj


@router.put("/{agendamento_id}", response_model=AgendamentoOut)
def atualizar(
    agendamento_id: int,
    payload: AgendamentoUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    obj = db.get(Agendamento, agendamento_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] is not None:
        if data["status"] not in ALLOWED_STATUS:
            raise HTTPException(
                status_code=422,
                detail=f"Status inválido. Use um de: {sorted(ALLOWED_STATUS)}.",
            )

    _validar_fk(data, db)

    profissional_id = data.get("profissional_id", obj.profissional_id)
    inicio = data.get("inicio", obj.inicio)
    especialidade_id = data.get("especialidade_id", obj.especialidade_id)
    modalidade = data.get("modalidade", obj.modalidade)

    _validar_telemedicina(especialidade_id, modalidade, db)
    _validar_conflito(profissional_id, inicio, db, ignore_id=obj.id)

    for k, v in data.items():
        setattr(obj, k, v)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Conflito: agendamento já existe para este horário/profissional.",
        )

    db.refresh(obj)
    return obj


@router.delete("/{agendamento_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(
    agendamento_id: int,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    obj = db.get(Agendamento, agendamento_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
    db.delete(obj)
    db.commit()
    return None
