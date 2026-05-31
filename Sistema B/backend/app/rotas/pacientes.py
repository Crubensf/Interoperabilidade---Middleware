import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.modelos.paciente import Paciente
from app.schemas.paciente import PacienteCreate, PacienteOut, PacienteUpdate


router = APIRouter(
    prefix="/api/pacientes",
    tags=["Pacientes"],
    dependencies=[Depends(get_current_user)],
)


def only_digits(s: str) -> str:
    return re.sub(r"\D+", "", str(s or ""))


def is_valid_cns(cns: str) -> bool:
    return bool(re.fullmatch(r"\d{15}", cns or ""))


def is_valid_tel(tel: str) -> bool:
    return bool(re.fullmatch(r"\d{10,11}", tel or ""))


def is_valid_cpf(cpf: str) -> bool:
    return bool(re.fullmatch(r"\d{11}", cpf or ""))


@router.get("/by-cns/{cns}", response_model=PacienteOut)
def buscar_por_cns(cns: str, db: Session = Depends(get_db)):
    cns_digits = only_digits(cns)
    if len(cns_digits) != 15:
        raise HTTPException(
            status_code=422,
            detail="CNS deve ter exatamente 15 dígitos.",
        )

    obj = db.scalar(select(Paciente).where(Paciente.cartao_sus == cns_digits))
    if not obj:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    return obj


@router.post("", response_model=PacienteOut, status_code=status.HTTP_201_CREATED)
def criar(payload: PacienteCreate, db: Session = Depends(get_db)):

    cpf_digits = only_digits(payload.cpf)

    if not is_valid_cpf(cpf_digits):
        raise HTTPException(
            status_code=422,
            detail="CPF deve conter exatamente 11 dígitos.",
        )

    # CPF único
    exists_cpf = db.scalar(
        select(Paciente).where(Paciente.cpf == cpf_digits)
    )
    if exists_cpf:
        raise HTTPException(
            status_code=409,
            detail="Já existe paciente com este CPF.",
        )

    # CNS opcional, mas se vier precisa ser válido e único
    if payload.cartao_sus:
        cns_digits = only_digits(payload.cartao_sus)

        if not is_valid_cns(cns_digits):
            raise HTTPException(
                status_code=422,
                detail="CNS deve conter exatamente 15 dígitos.",
            )

        exists_cns = db.scalar(
            select(Paciente).where(Paciente.cartao_sus == cns_digits)
        )
        if exists_cns:
            raise HTTPException(
                status_code=409,
                detail="Já existe paciente com este cartão SUS.",
            )

    data = payload.model_dump()
    data["cpf"] = cpf_digits
    data["cartao_sus"] = only_digits(
        payload.cartao_sus) if payload.cartao_sus else None

    obj = Paciente(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("", response_model=list[PacienteOut])
def listar(db: Session = Depends(get_db)):
    rows = list(db.scalars(select(Paciente).order_by(Paciente.nome)).all())
    return rows


@router.get("/{paciente_id}", response_model=PacienteOut)
def detalhar(paciente_id: int, db: Session = Depends(get_db)):
    obj = db.get(Paciente, paciente_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    return obj


@router.put("/{paciente_id}", response_model=PacienteOut)
def atualizar(
    paciente_id: int,
    payload: PacienteUpdate,
    db: Session = Depends(get_db),
):
    obj = db.get(Paciente, paciente_id)
    if not obj:
        raise HTTPException(
            status_code=404,
            detail="Paciente não encontrado."
        )

    data = payload.model_dump(exclude_none=True)

    # ---------- CPF ----------
    if "cpf" in data:
        cpf_digits = only_digits(data["cpf"])

        if not is_valid_cpf(cpf_digits):
            raise HTTPException(
                status_code=422,
                detail="CPF deve conter exatamente 11 dígitos."
            )

        if cpf_digits != obj.cpf:
            exists = db.scalar(
                select(Paciente).where(Paciente.cpf == cpf_digits)
            )
            if exists:
                raise HTTPException(
                    status_code=409,
                    detail="Já existe paciente com este CPF."
                )

        data["cpf"] = cpf_digits

    # ---------- CARTÃO SUS (opcional) ----------
    if "cartao_sus" in data:
        if data["cartao_sus"]:
            cns_digits = only_digits(data["cartao_sus"])

            if not is_valid_cns(cns_digits):
                raise HTTPException(
                    status_code=422,
                    detail="CNS deve conter exatamente 15 dígitos."
                )

            if cns_digits != obj.cartao_sus:
                exists = db.scalar(
                    select(Paciente).where(Paciente.cartao_sus == cns_digits)
                )
                if exists:
                    raise HTTPException(
                        status_code=409,
                        detail="Já existe paciente com este cartão SUS."
                    )

            data["cartao_sus"] = cns_digits
        else:
            # permite remover CNS
            data["cartao_sus"] = None

    # ---------- TELEFONE ----------
    if "telefone" in data:
        tel_digits = only_digits(data["telefone"])

        if not is_valid_tel(tel_digits):
            raise HTTPException(
                status_code=422,
                detail="Telefone deve ter 10 ou 11 dígitos."
            )

        data["telefone"] = tel_digits

    # ---------- ATUALIZA CAMPOS ----------
    for k, v in data.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj



@router.delete("/{paciente_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(paciente_id: int, db: Session = Depends(get_db)):
    obj = db.get(Paciente, paciente_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    db.delete(obj)
    db.commit()
    return None

@router.get("/by-cpf/{cpf}", response_model=PacienteOut)
def buscar_por_cpf(cpf: str, db: Session = Depends(get_db)):
    cpf_digits = only_digits(cpf)

    if not is_valid_cpf(cpf_digits):
        raise HTTPException(
            status_code=422,
            detail="CPF deve conter exatamente 11 dígitos.",
        )

    obj = db.scalar(select(Paciente).where(Paciente.cpf == cpf_digits))
    if not obj:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    return obj
