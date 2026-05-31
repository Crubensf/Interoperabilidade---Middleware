from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.modelos.especialidade import Especialidade
from app.schemas.especialidade import EspecialidadeCreate, EspecialidadeOut, EspecialidadeUpdate

router = APIRouter(prefix="/api/especialidades", tags=["Especialidades"])


@router.post("", response_model=EspecialidadeOut, status_code=status.HTTP_201_CREATED)
def criar(payload: EspecialidadeCreate, db: Session = Depends(get_db)):
    exists = db.scalar(select(Especialidade).where(Especialidade.codigo == payload.codigo))
    if exists:
        raise HTTPException(status_code=409, detail="Já existe especialidade com este código.")
    obj = Especialidade(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("", response_model=list[EspecialidadeOut])
def listar(db: Session = Depends(get_db)):
    return list(db.scalars(select(Especialidade).order_by(Especialidade.nome)).all())


@router.get("/{especialidade_id}", response_model=EspecialidadeOut)
def detalhar(especialidade_id: int, db: Session = Depends(get_db)):
    obj = db.get(Especialidade, especialidade_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Especialidade não encontrada.")
    return obj


@router.put("/{especialidade_id}", response_model=EspecialidadeOut)
def atualizar(especialidade_id: int, payload: EspecialidadeUpdate, db: Session = Depends(get_db)):
    obj = db.get(Especialidade, especialidade_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Especialidade não encontrada.")

    data = payload.model_dump(exclude_unset=True)
    if "codigo" in data and data["codigo"] != obj.codigo:
        exists = db.scalar(select(Especialidade).where(Especialidade.codigo == data["codigo"]))
        if exists:
            raise HTTPException(status_code=409, detail="Já existe especialidade com este código.")

    for k, v in data.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{especialidade_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(especialidade_id: int, db: Session = Depends(get_db)):
    obj = db.get(Especialidade, especialidade_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Especialidade não encontrada.")
    db.delete(obj)
    db.commit()
    return None
