from fastapi import APIRouter, HTTPException, Query

from app.agregador import coletar_entries
from app.fhir.normalizer import (
    deduplicar_profissionais,
    filtrar_por_tipo,
    filtrar_practitioner,
    paginar,
    resumir_profissional,
)

router = APIRouter(prefix="/profissionais", tags=["Profissionais"])


@router.get("")
async def listar_profissionais(
    origem: str = Query("ambos", pattern="^(ambos|sistema_a|sistema_b)$"),
    dedup: bool = Query(True),
    identifier: str | None = Query(None, description="CRM unificado (UF+dígitos)"),
    name: str | None = None,
    offset: int = Query(0, ge=0),
    count: int = Query(50, ge=1, le=500, alias="_count"),
):
    try:
        entries = await coletar_entries(origem=origem)  # type: ignore[arg-type]
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    practitioners = filtrar_por_tipo(entries, "Practitioner")
    if dedup:
        practitioners = deduplicar_profissionais(practitioners)
    practitioners = filtrar_practitioner(practitioners, identifier=identifier, name=name)
    pagina, total = paginar(practitioners, offset, count)

    return {
        "total": total,
        "offset": offset,
        "count": len(pagina),
        "items": [resumir_profissional(e["resource"]) for e in pagina],
    }
