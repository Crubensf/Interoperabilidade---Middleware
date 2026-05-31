from __future__ import annotations

import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.modelos.especialidade import Especialidade
from app.modelos.local_atendimento import LocalAtendimento
from app.modelos.profissional import Profissional


ESPECIALIDADES = [
    ("Clínico Geral", True),
    ("Ginecologia e Obstetrícia", False),
    ("Hepatologia", False),
    ("Pediatria", False),
    ("Cardiologia", False),
    ("Dermatologia", False),
    ("Neurologia", False),
    ("Psiquiatria", False),
    ("Endocrinologia", False),
    ("Ortopedia", False),
    ("Otorrinolaringologia", False),
    ("Urologia", False),
    ("Psicologia", True),
    ("Nutrição", True),
    ("Endoscopia digestiva alta", False),
    ("Ultrassonografia", False),
]

LOCAIS = [
    ("UBS Canto da Várzea", "Av. Principal, 1000", "Picos"),
    ("UE UFPI CSHNB", "Rua X, 123", "Picos"),
]

PROFISSIONAIS_POR_ESPECIALIDADE = {
    "Clínico Geral": "Dra. Ana Paula",
    "Ginecologia e Obstetrícia": "Dra. Maria Souza",
    "Hepatologia": "Dr. Pedro Almeida",
    "Pediatria": "Dra. Juliana Costa",
    "Cardiologia": "Dr. João Silva",
    "Dermatologia": "Dra. Camila Rocha",
    "Neurologia": "Dr. Rafael Nogueira",
    "Psiquiatria": "Dr. Bruno Fernandes",
    "Endocrinologia": "Dra. Renata Ribeiro",
    "Ortopedia": "Dr. Carlos Pereira",
    "Otorrinolaringologia": "Dr. Felipe Martins",
    "Urologia": "Dr. Gustavo Araújo",
    "Psicologia": "Psicóloga Carla Lima",
    "Nutrição": "Nutricionista Bruno",
    "Endoscopia digestiva alta": "Dr. Marcelo Azevedo",
    "Ultrassonografia": "Dra. Larissa Freitas",
}


def _slug_codigo(nome: str) -> str:
    s = unicodedata.normalize("NFKD", nome)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.upper().strip()
    s = re.sub(r"[^A-Z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s[:80]


def _seed_especialidades(db: Session) -> None:
    for nome, tele in ESPECIALIDADES:
        codigo = _slug_codigo(nome)

        esp = db.scalar(select(Especialidade).where(Especialidade.codigo == codigo))
        if esp:
            if esp.nome != nome:
                esp.nome = nome
            if esp.permite_telemedicina != tele:
                esp.permite_telemedicina = tele
            continue

        esp_por_nome = db.scalar(select(Especialidade).where(Especialidade.nome == nome))
        if esp_por_nome:
            esp_por_nome.codigo = codigo
            esp_por_nome.permite_telemedicina = tele
            continue

        db.add(Especialidade(codigo=codigo, nome=nome, permite_telemedicina=tele))


def _seed_locais(db: Session) -> None:
    for nome, endereco, municipio in LOCAIS:
        existe = db.scalar(select(LocalAtendimento).where(LocalAtendimento.nome == nome))
        if existe:
            continue
        db.add(LocalAtendimento(nome=nome, endereco=endereco, municipio=municipio))


def _seed_profissionais_para_todas_especialidades(db: Session) -> None:
    especialidades = list(db.scalars(select(Especialidade)).all())

    for esp in especialidades:
        ja_tem = db.scalar(select(Profissional).where(Profissional.especialidade_id == esp.id))
        if ja_tem:
            continue

        nome_prof = PROFISSIONAIS_POR_ESPECIALIDADE.get(esp.nome)
        if not nome_prof:
            nome_prof = f"Dr(a). {esp.nome}"

        db.add(Profissional(nome=nome_prof, especialidade_id=esp.id))


def bootstrap_all() -> None:
    db = SessionLocal()
    try:
        _seed_especialidades(db)
        db.commit()

        _seed_locais(db)
        db.commit()

        _seed_profissionais_para_todas_especialidades(db)
        db.commit()
    finally:
        db.close()
