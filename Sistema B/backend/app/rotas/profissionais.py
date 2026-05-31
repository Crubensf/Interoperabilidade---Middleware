from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.modelos.profissional import Profissional
from app.modelos.especialidade import Especialidade
from app.schemas.profissional import ProfissionalCreate, ProfissionalOut, ProfissionalUpdate


router = APIRouter(
    prefix="/api/profissionais",
    tags=["Profissionais"],
    dependencies=[Depends(get_current_user)],
)


@router.post("", response_model=ProfissionalOut, status_code=status.HTTP_201_CREATED)
def criar(payload: ProfissionalCreate, db: Session = Depends(get_db)):
    esp = db.get(Especialidade, payload.especialidade_id)
    if not esp:
        raise HTTPException(status_code=404, detail="Especialidade não encontrada.")

    if payload.crm and payload.crm_uf:
        exists = db.scalar(
            select(Profissional).where(
                Profissional.crm == payload.crm,
                Profissional.crm_uf == payload.crm_uf,
            )
        )
        if exists:
            raise HTTPException(
                status_code=409,
                detail="Já existe profissional com este CRM/UF.",
            )

    obj = Profissional(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("", response_model=list[ProfissionalOut])
def listar(
    especialidade_id: int | None = Query(default=None),
    somente_ativos: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    stmt = select(Profissional)
    if especialidade_id is not None:
        stmt = stmt.where(Profissional.especialidade_id == especialidade_id)
    if somente_ativos:
        stmt = stmt.where(Profissional.ativo.is_(True))

    stmt = stmt.order_by(Profissional.nome)
    return list(db.scalars(stmt).all())


@router.get("/{profissional_id}", response_model=ProfissionalOut)
def detalhar(profissional_id: int, db: Session = Depends(get_db)):
    obj = db.get(Profissional, profissional_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    return obj


@router.put("/{profissional_id}", response_model=ProfissionalOut)
def atualizar(profissional_id: int, payload: ProfissionalUpdate, db: Session = Depends(get_db)):
    obj = db.get(Profissional, profissional_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")

    data = payload.model_dump(exclude_unset=True)

    if "especialidade_id" in data and data["especialidade_id"] is not None:
        esp = db.get(Especialidade, data["especialidade_id"])
        if not esp:
            raise HTTPException(status_code=404, detail="Especialidade não encontrada.")

    if "crm" in data or "crm_uf" in data:
        new_crm = data.get("crm", obj.crm)
        new_crm_uf = data.get("crm_uf", obj.crm_uf)

        if new_crm and new_crm_uf:
            exists = db.scalar(
                select(Profissional).where(
                    Profissional.crm == new_crm,
                    Profissional.crm_uf == new_crm_uf,
                    Profissional.id != obj.id,
                )
            )
            if exists:
                raise HTTPException(
                    status_code=409,
                    detail="Já existe profissional com este CRM/UF.",
                )

    for k, v in data.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{profissional_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(profissional_id: int, db: Session = Depends(get_db)):
    obj = db.get(Profissional, profissional_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    db.delete(obj)
    db.commit()
    return None
