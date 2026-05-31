from fastapi import APIRouter, HTTPException, Query

from app.agregador import coletar_entries
from app.fhir.normalizer import (
    CNS_SYSTEM,
    CPF_SYSTEM,
    CRM_SYSTEM,
    _identifier_value,
    filtrar_por_tipo,
)
from app.mpi.repository import (
    listar_pacientes_indexados,
    listar_profissionais_indexados,
    upsert_paciente,
    upsert_profissional,
)
from app.qualidade import analisar_qualidade, listar_duplicatas

router = APIRouter(tags=["Qualidade"])


def _origem_de(resource: dict) -> str | None:
    from app.fhir.normalizer import SOURCE_TAG_SYSTEM
    for t in (resource.get("meta") or {}).get("tag", []) or []:
        if t.get("system") == SOURCE_TAG_SYSTEM:
            return t.get("code")
    return None


@router.get("/qualidade")
async def qualidade_dados():
    try:
        entries = await coletar_entries(origem="ambos")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return analisar_qualidade(entries)


@router.get("/duplicatas")
async def duplicatas():
    try:
        entries = await coletar_entries(origem="ambos")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return listar_duplicatas(entries)


@router.post("/mpi/reconciliar")
async def reconciliar(
    persistir: bool = Query(True, description="Grava no MPI persistido (SQLite)"),
):
    """Lê A e B, persiste o índice de identidade no MPI local."""
    try:
        entries = await coletar_entries(origem="ambos")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    pac_count = prof_count = 0
    if persistir:
        for e in filtrar_por_tipo(entries, "Patient"):
            r = e["resource"]
            origem = _origem_de(r)
            if not origem:
                continue
            cns = _identifier_value(r, CNS_SYSTEM)
            cpf = _identifier_value(r, CPF_SYSTEM)
            if not (cns or cpf):
                continue
            nome = (r.get("name") or [{}])[0].get("text")
            upsert_paciente(cns=cns, cpf=cpf, nome=nome, sistema=origem, sistema_id=str(r.get("id")))
            pac_count += 1

        for e in filtrar_por_tipo(entries, "Practitioner"):
            r = e["resource"]
            origem = _origem_de(r)
            if not origem:
                continue
            crm = _identifier_value(r, CRM_SYSTEM)
            if not crm:
                continue
            nome = (r.get("name") or [{}])[0].get("text")
            upsert_profissional(crm=crm, nome=nome, sistema=origem, sistema_id=str(r.get("id")))
            prof_count += 1

    return {
        "persistido": persistir,
        "pacientes_indexados": pac_count,
        "profissionais_indexados": prof_count,
    }


@router.get("/mpi/pacientes")
def mpi_pacientes(somente_duplicados: bool = False):
    return listar_pacientes_indexados(somente_duplicados=somente_duplicados)


@router.get("/mpi/profissionais")
def mpi_profissionais(somente_duplicados: bool = False):
    return listar_profissionais_indexados(somente_duplicados=somente_duplicados)
