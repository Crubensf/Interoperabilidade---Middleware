from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.modelos.local_atendimento import LocalAtendimento
from app.schemas.local_atendimento import LocalCreate, LocalOut, LocalUpdate

router = APIRouter(prefix="/api/locais", tags=["Locais"])


@router.post("", response_model=LocalOut, status_code=status.HTTP_201_CREATED)
def criar(payload: LocalCreate, db: Session = Depends(get_db)):
    obj = LocalAtendimento(**payload.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("", response_model=list[LocalOut])
def listar(db: Session = Depends(get_db)):
    return list(db.scalars(select(LocalAtendimento).order_by(LocalAtendimento.nome)).all())


@router.get("/{local_id}", response_model=LocalOut)
def detalhar(local_id: int, db: Session = Depends(get_db)):
    obj = db.get(LocalAtendimento, local_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Local não encontrado.")
    return obj


@router.put("/{local_id}", response_model=LocalOut)
def atualizar(local_id: int, payload: LocalUpdate, db: Session = Depends(get_db)):
    obj = db.get(LocalAtendimento, local_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Local não encontrado.")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{local_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(local_id: int, db: Session = Depends(get_db)):
    obj = db.get(LocalAtendimento, local_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Local não encontrado.")
    db.delete(obj)
    db.commit()
    return None
