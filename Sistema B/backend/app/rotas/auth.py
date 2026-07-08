
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
)
from app.modelos.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioOut, LoginRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/signup", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def signup(payload: UsuarioCreate, db: Session = Depends(get_db)):
    exists = db.scalar(select(Usuario).where(Usuario.email == payload.email))
    if exists:
        raise HTTPException(status_code=409, detail="Já existe usuário com este e-mail.")

    usuario = Usuario(
        nome=payload.nome,
        email=payload.email,
        senha_hash=get_password_hash(payload.senha),
        is_admin=False,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    print(f"LOGIN ATTEMPT: email='{payload.email}' senha='{payload.senha}'")
    usuario = db.scalar(select(Usuario).where(Usuario.email == payload.email))
    if not usuario or not verify_password(payload.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")

    token = create_access_token({"sub": str(usuario.id)})
    return TokenResponse(access_token=token)
