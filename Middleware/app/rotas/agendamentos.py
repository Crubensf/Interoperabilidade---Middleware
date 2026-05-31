from fastapi import APIRouter, HTTPException, Query

from app.agregador import coletar_entries
from app.fhir.normalizer import (
    filtrar_appointment,
    filtrar_por_tipo,
    paginar,
    resumir_agendamento,
)

router = APIRouter(prefix="/agendamentos", tags=["Agendamentos"])


@router.get("")
async def listar_agendamentos(
    origem: str = Query("ambos", pattern="^(ambos|sistema_a|sistema_b)$"),
    status: str | None = Query(None, description="Status FHIR: booked, pending, etc."),
    date_ge: str | None = Query(None, alias="date_ge", description="ISO date >="),
    date_le: str | None = Query(None, alias="date_le", description="ISO date <="),
    offset: int = Query(0, ge=0),
    count: int = Query(50, ge=1, le=500, alias="_count"),
):
    try:
        entries = await coletar_entries(origem=origem)  # type: ignore[arg-type]
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    appts = filtrar_por_tipo(entries, "Appointment")
    appts = filtrar_appointment(appts, status=status, date_ge=date_ge, date_le=date_le)
    pagina, total = paginar(appts, offset, count)

    return {
        "total": total,
        "offset": offset,
        "count": len(pagina),
        "items": [resumir_agendamento(e["resource"]) for e in pagina],
    }
