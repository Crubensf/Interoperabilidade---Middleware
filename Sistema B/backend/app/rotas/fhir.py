import json
from io import BytesIO
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select

from app.core.database import get_db
from app.modelos.paciente import Paciente
from app.modelos.agendamento import Agendamento
from app.modelos.profissional import Profissional
from app.modelos.local_atendimento import LocalAtendimento

from app.serializadores_fhir.paciente import paciente_para_fhir
from app.serializadores_fhir.profissional import profissional_para_fhir
from app.serializadores_fhir.local import local_para_fhir
from app.serializadores_fhir.agendamento import agendamento_para_fhir
from app.serializadores_fhir.bundle import (
    montar_bundle_agendamento,
    montar_bundle_geral_transacao,
)

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.core.security import get_current_user

router = APIRouter(
    prefix="/fhir",
    tags=["FHIR R4"],
    dependencies=[Depends(get_current_user)],
)


def _fmt_dt_br(dt) -> str:
    if dt is None:
        return "-"
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return dt
    try:
        return dt.astimezone().strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(dt)


def _safe(v) -> str:
    return "-" if v is None else str(v)


def gerar_pdf_bundle_json(titulo: str, bundle: dict) -> bytes:
    texto = json.dumps(bundle, ensure_ascii=False, indent=2)

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    _, height = A4
    y = height - 40

    c.setTitle(titulo)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(40, y, titulo)
    y -= 16
    c.setFont("Helvetica", 9)
    c.drawString(40, y, f"Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    y -= 14
    c.setFont("Courier", 8)

    for line in texto.splitlines():
        chunks = [line[i : i + 118] for i in range(0, len(line), 118)] or [""]
        for chunk in chunks:
            if y <= 35:
                c.showPage()
                y = height - 40
                c.setFont("Courier", 8)
            c.drawString(40, y, chunk)
            y -= 10

    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def gerar_pdf_comprovante(a: Agendamento) -> bytes:
    p = a.paciente
    prof = a.profissional
    loc = a.local
    esp = a.especialidade
    usuario = getattr(a, "criado_por", None)

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 60

    c.setTitle(f"Comprovante - Agendamento #{a.id}")
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "Comprovante de Agendamento (UBS)")
    y -= 25

    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    y -= 18

    c.setLineWidth(1)
    c.line(50, y, width - 50, y)
    y -= 22

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Dados do paciente")
    y -= 16
    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"Nome: {_safe(getattr(p, 'nome', None))}")
    y -= 14
    c.drawString(50, y, f"CNS: {_safe(getattr(p, 'cartao_sus', None))}")
    y -= 14
    c.drawString(50, y, f"Data de nascimento: {_safe(str(getattr(p, 'data_nascimento', '-'))[:10])}")
    y -= 14
    c.drawString(50, y, f"Telefone: {_safe(getattr(p, 'telefone', None))}")
    y -= 14
    c.drawString(50, y, f"Município: {_safe(getattr(p, 'municipio', None))}")
    y -= 14
    c.drawString(50, y, f"Endereço: {_safe(getattr(p, 'endereco', None))}")
    y -= 14
    c.drawString(50, y, f"Nome da mãe: {_safe(getattr(p, 'nome_mae', None))}")
    y -= 22

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Dados do atendimento")
    y -= 16
    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"Nº do agendamento: #{_safe(getattr(a, 'id', None))}")
    y -= 14
    c.drawString(50, y, f"Data/Hora: {_fmt_dt_br(getattr(a, 'inicio', None))}")
    y -= 14
    c.drawString(50, y, f"Especialidade: {_safe(getattr(esp, 'nome', None))}")
    y -= 14

    crm_str = ""
    if getattr(prof, "crm", None) and getattr(prof, "crm_uf", None):
        crm_str = f" (CRM {prof.crm}-{prof.crm_uf})"

    c.drawString(50, y, f"Profissional: {_safe(getattr(prof, 'nome', None))}{crm_str}")
    y -= 14
    c.drawString(50, y, f"Local: {_safe(getattr(loc, 'nome', None))}")
    y -= 14
    c.drawString(50, y, f"Endereço do local: {_safe(getattr(loc, 'endereco', None))}")
    y -= 14
    c.drawString(50, y, f"Modalidade: {_safe(getattr(a, 'modalidade', None))}")
    y -= 14
    c.drawString(50, y, f"Status: {_safe(getattr(a, 'status', None))}")
    y -= 14

    if usuario:
        c.drawString(50, y, f"Agendado por: {_safe(getattr(usuario, 'nome', None))}")
        y -= 14

    y -= 10
    c.setFont("Helvetica", 10)
    c.drawString(50, y, "Orientações: chegue com 15 minutos de antecedência (se presencial).")
    y -= 12
    c.drawString(50, y, "Em caso de dúvidas, procure a recepção da unidade.")
    y -= 20

    c.setLineWidth(1)
    c.line(50, 80, width - 50, 80)
    c.setFont("Helvetica", 9)
    c.drawString(50, 65, "Este documento é um comprovante de agendamento e pode ser impresso.")
    c.drawString(50, 52, "Sistema de Agendamento UBS (Projeto PET)")

    c.showPage()
    c.save()

    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


@router.get("/patient/{paciente_id}")
def get_patient_fhir(paciente_id: int, db: Session = Depends(get_db)):
    p = db.get(Paciente, paciente_id)
    if not p:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")
    return JSONResponse(content=paciente_para_fhir(p), media_type="application/fhir+json")


@router.get("/practitioner/{profissional_id}")
def get_practitioner_fhir(profissional_id: int, db: Session = Depends(get_db)):
    prof = db.get(Profissional, profissional_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    return JSONResponse(content=profissional_para_fhir(prof), media_type="application/fhir+json")


@router.get("/location/{local_id}")
def get_location_fhir(local_id: int, db: Session = Depends(get_db)):
    loc = db.get(LocalAtendimento, local_id)
    if not loc:
        raise HTTPException(status_code=404, detail="Local não encontrado.")
    return JSONResponse(content=local_para_fhir(loc), media_type="application/fhir+json")


@router.get("/appointment/{agendamento_id}")
def get_appointment_fhir(agendamento_id: int, db: Session = Depends(get_db)):
    a = db.get(Agendamento, agendamento_id)
    if not a:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    _ = a.paciente, a.profissional, a.especialidade, a.local

    return JSONResponse(content=agendamento_para_fhir(a), media_type="application/fhir+json")


@router.get("/bundle/agendamento/{agendamento_id}")
def get_agendamento_bundle_fhir(agendamento_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Agendamento)
        .options(
            joinedload(Agendamento.paciente),
            joinedload(Agendamento.profissional),
            joinedload(Agendamento.local),
            joinedload(Agendamento.especialidade),
        )
        .where(Agendamento.id == agendamento_id)
    )
    a = db.execute(stmt).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    return JSONResponse(
        content=montar_bundle_agendamento(a),
        media_type="application/fhir+json",
    )


@router.get("/bundle/geral/transaction")
def get_bundle_geral_transaction_fhir(db: Session = Depends(get_db)):
    pacientes = db.scalars(select(Paciente).order_by(Paciente.nome.asc())).all()
    profissionais = db.scalars(select(Profissional).order_by(Profissional.nome.asc())).all()
    locais = db.scalars(select(LocalAtendimento).order_by(LocalAtendimento.nome.asc())).all()
    agendamentos = db.scalars(
        select(Agendamento)
        .options(
            joinedload(Agendamento.paciente),
            joinedload(Agendamento.profissional),
            joinedload(Agendamento.local),
            joinedload(Agendamento.especialidade),
        )
        .order_by(Agendamento.inicio.desc())
    ).all()

    bundle = montar_bundle_geral_transacao(
        pacientes=pacientes,
        profissionais=profissionais,
        agendamentos=agendamentos,
        locais=locais,
    )
    return JSONResponse(content=bundle, media_type="application/fhir+json")


@router.get("/bundle/geral/pdf")
def get_bundle_geral_pdf(db: Session = Depends(get_db)):
    pacientes = db.scalars(select(Paciente).order_by(Paciente.nome.asc())).all()
    profissionais = db.scalars(select(Profissional).order_by(Profissional.nome.asc())).all()
    locais = db.scalars(select(LocalAtendimento).order_by(LocalAtendimento.nome.asc())).all()
    agendamentos = db.scalars(
        select(Agendamento)
        .options(
            joinedload(Agendamento.paciente),
            joinedload(Agendamento.profissional),
            joinedload(Agendamento.local),
            joinedload(Agendamento.especialidade),
        )
        .order_by(Agendamento.inicio.desc())
    ).all()

    bundle = montar_bundle_geral_transacao(
        pacientes=pacientes,
        profissionais=profissionais,
        agendamentos=agendamentos,
        locais=locais,
    )
    pdf_bytes = gerar_pdf_bundle_json("Bundle Geral FHIR (transaction)", bundle)
    headers = {"Content-Disposition": 'inline; filename="bundle_geral_fhir.pdf"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.get("/bundle/comprovante/{agendamento_id}")
def get_comprovante_pdf(agendamento_id: int, db: Session = Depends(get_db)):
    a = db.get(Agendamento, agendamento_id)
    if not a:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    _ = a.paciente, a.profissional, a.local, a.especialidade
    if not all([a.paciente, a.profissional, a.local, a.especialidade]):
        raise HTTPException(
            status_code=409,
            detail="Dados relacionados incompletos para gerar comprovante.",
        )

    pdf_bytes = gerar_pdf_comprovante(a)
    filename = f"comprovante_agendamento_{a.id}.pdf"
    headers = {"Content-Disposition": f'inline; filename="{filename}"'}

    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
