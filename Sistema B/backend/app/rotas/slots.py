from datetime import datetime, date, time, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_db
from app.modelos.profissional import Profissional
from app.modelos.agendamento import Agendamento

router = APIRouter(prefix="/api/slots", tags=["Slots"])


def _parse_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="Parâmetro date deve estar em YYYY-MM-DD.")


@router.get("")
def listar_slots_disponiveis(
    profissional_id: int = Query(...),
    date_str: str = Query(..., alias="date"),
    slot_minutes: int = Query(30, ge=10, le=120),
    start_hour: int = Query(8, ge=0, le=23),
    end_hour: int = Query(17, ge=1, le=23),
    db: Session = Depends(get_db),
):
    prof = db.get(Profissional, profissional_id)
    if not prof:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")

    d = _parse_date(date_str)

    inicio_janela = datetime.combine(d, time(hour=start_hour, minute=0))
    fim_janela = datetime.combine(d, time(hour=end_hour, minute=0))

    # busca agendamentos do dia do profissional
    stmt = select(Agendamento.inicio).where(
        Agendamento.profissional_id == profissional_id,
        Agendamento.inicio >= inicio_janela,
        Agendamento.inicio < fim_janela,
        Agendamento.status != "cancelled",
    )
    ocupados = set(db.scalars(stmt).all())

    slots = []
    cur = inicio_janela
    step = timedelta(minutes=slot_minutes)
    while cur < fim_janela:
        if cur not in ocupados:
            slots.append(cur.isoformat())
        cur += step

    return {
        "profissional_id": profissional_id,
        "date": d.isoformat(),
        "slot_minutes": slot_minutes,
        "available": slots,
    }
