from fastapi import APIRouter, HTTPException, Query

from app.agregador import coletar_entries
from app.analytics import agregar_tudo
from app.fhir.normalizer import (
    construir_lookup,
    filtrar_appointment,
    filtrar_por_tipo,
    resumir_agendamento,
)

router = APIRouter(prefix="/estatisticas", tags=["Estatísticas"])


@router.get("/agendamentos")
async def estatisticas_agendamentos(
    origem: str = Query("ambos", pattern="^(ambos|sistema_a|sistema_b)$"),
    date_ge: str | None = Query(None, alias="date_ge"),
    date_le: str | None = Query(None, alias="date_le"),
    limite_top: int = Query(10, ge=3, le=50),
):
    try:
        entries = await coletar_entries(origem=origem)  # type: ignore[arg-type]
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    lookup = construir_lookup(entries)
    appts = filtrar_por_tipo(entries, "Appointment")
    appts = filtrar_appointment(appts, status=None, date_ge=date_ge, date_le=date_le)
    summaries = [resumir_agendamento(e["resource"], lookup) for e in appts]

    payload = agregar_tudo(summaries, limite_top=limite_top)
    payload["filtros"] = {"origem": origem, "date_ge": date_ge, "date_le": date_le}
    return payload
