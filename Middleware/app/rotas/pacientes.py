from fastapi import APIRouter, HTTPException, Query

from app.agregador import coletar_entries
from app.fhir.normalizer import (
    deduplicar_pacientes,
    filtrar_patient,
    filtrar_por_tipo,
    paginar,
    resumir_paciente,
)

router = APIRouter(prefix="/pacientes", tags=["Pacientes"])


@router.get("")
async def listar_pacientes(
    origem: str = Query("ambos", pattern="^(ambos|sistema_a|sistema_b)$"),
    dedup: bool = Query(True, description="De-duplicar por CNS/CPF"),
    identifier: str | None = Query(None, description="CNS, CPF ou outro identifier"),
    name: str | None = Query(None, description="Substring do nome"),
    offset: int = Query(0, ge=0),
    count: int = Query(50, ge=1, le=500, alias="_count"),
):
    try:
        entries = await coletar_entries(origem=origem)  # type: ignore[arg-type]
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    patients = filtrar_por_tipo(entries, "Patient")
    if dedup:
        patients = deduplicar_pacientes(patients)
    patients = filtrar_patient(patients, identifier=identifier, name=name)
    pagina, total = paginar(patients, offset, count)

    return {
        "total": total,
        "offset": offset,
        "count": len(pagina),
        "items": [resumir_paciente(e["resource"]) for e in pagina],
    }
