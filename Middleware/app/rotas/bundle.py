from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.agregador import coletar_entries
from app.fhir.bundle import montar_bundle_unificado
from app.fhir.normalizer import (
    deduplicar_pacientes,
    deduplicar_profissionais,
    filtrar_por_tipo,
)

router = APIRouter(prefix="/fhir", tags=["FHIR Unificado"])


@router.get("/bundle")
async def bundle_unificado(
    origem: str = Query("ambos", pattern="^(ambos|sistema_a|sistema_b)$"),
    dedup: bool = Query(True, description="De-duplicar Patient/Practitioner cross-sistema"),
):
    try:
        entries = await coletar_entries(origem=origem)  # type: ignore[arg-type]
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if dedup:
        pacientes = deduplicar_pacientes(filtrar_por_tipo(entries, "Patient"))
        profissionais = deduplicar_profissionais(filtrar_por_tipo(entries, "Practitioner"))
        outros = [
            e for e in entries
            if (e.get("resource") or {}).get("resourceType") not in {"Patient", "Practitioner"}
        ]
        entries = pacientes + profissionais + outros

    bundle = montar_bundle_unificado(entries)
    return JSONResponse(content=bundle, media_type="application/fhir+json")
