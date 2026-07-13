"""Endpoint de detalhe consolidado de paciente — usado pelo modal do dashboard.

Procura o paciente por CNS/CPF (ou nome aproximado) em A e B, retorna ambas as
versões, todos os agendamentos relacionados e um diff campo-a-campo.
"""
from fastapi import APIRouter, HTTPException, Query

from app.agregador import coletar_entries
from app.fhir.normalizer import (
    CNS_SYSTEM,
    CPF_SYSTEM,
    CRM_SYSTEM,
    SOURCE_TAG_SYSTEM,
    _identifier_value,
    construir_lookup,
    filtrar_por_tipo,
    resumir_paciente,
    resumir_agendamento,
    resumir_profissional,
)

router = APIRouter(tags=["Detalhe"])


def _origem(resource: dict) -> str | None:
    for t in (resource.get("meta") or {}).get("tag", []) or []:
        if t.get("system") == SOURCE_TAG_SYSTEM:
            return t.get("code")
    return None


def _matches(paciente_resource: dict, identifier: str | None, nome: str | None) -> bool:
    if identifier:
        ident = identifier.strip()
        cns = _identifier_value(paciente_resource, CNS_SYSTEM)
        cpf = _identifier_value(paciente_resource, CPF_SYSTEM)
        if cns == ident or cpf == ident:
            return True
        if str(paciente_resource.get("id")) == ident:
            return True
        return False
    if nome:
        nm = nome.strip().lower()
        for n in paciente_resource.get("name", []) or []:
            if nm in (n.get("text") or "").lower():
                return True
    return False


def _compute_diff(a: dict | None, b: dict | None) -> list[dict]:
    """Diff campo-a-campo entre versão A e B. Cada item: {campo, a, b, igual}."""
    if not a or not b:
        return []
    campos = [
        ("Nome", "nome"), ("CPF", "cpf"), ("CNS", "cartao_sus"),
        ("Sexo", "sexo"), ("Data de nascimento", "data_nascimento"),
        ("Telefone", "telefone"), ("E-mail", "email"),
    ]
    saida = []
    for label, key in campos:
        va = a.get(key)
        vb = b.get(key)
        igual = (va or "").strip().lower() == (vb or "").strip().lower() if (va and vb) else (va == vb)
        saida.append({"campo": label, "a": va, "b": vb, "igual": bool(igual)})
    return saida


@router.get("/pacientes/detalhe")
async def detalhe_paciente(
    identifier: str | None = Query(None, description="CNS, CPF ou ID interno"),
    nome: str | None = Query(None, description="busca por substring de nome"),
):
    if not (identifier or nome):
        raise HTTPException(status_code=400, detail="Informe identifier ou nome.")

    try:
        entries = await coletar_entries(origem="ambos")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    # 1. Encontra todos os pacientes que casam (pode ter A e B)
    pacientes_entries = filtrar_por_tipo(entries, "Patient")
    matches = [e for e in pacientes_entries if _matches(e["resource"], identifier, nome)]
    if not matches:
        raise HTTPException(status_code=404, detail="Paciente não encontrado.")

    # 2. Para cada match, monta versão resumida + recurso FHIR completo
    versoes = []
    chaves_pacientes: set[tuple[str, str]] = set()
    for e in matches:
        r = e["resource"]
        origem = _origem(r) or "?"
        resumo = resumir_paciente(r)
        versoes.append({
            "origem": origem,
            "id": r.get("id"),
            "resumo": resumo,
            "fhir": r,
        })
        chaves_pacientes.add((origem, str(r.get("id"))))

    # 3. Busca agendamentos relacionados — cruza pela referência Patient/{id}
    lookup = construir_lookup(entries)
    agendamentos_entries = filtrar_por_tipo(entries, "Appointment")
    timeline = []
    for ae in agendamentos_entries:
        ag = ae["resource"]
        ag_origem = _origem(ag) or "?"
        # checa se algum participant.reference bate com um dos pacientes encontrados
        for p in ag.get("participant", []) or []:
            ref = (p.get("actor") or {}).get("reference") or ""
            # ref pode ser "Patient/123" ou "urn:uuid:..."
            for orig, pid in chaves_pacientes:
                if orig == ag_origem and (
                    ref.endswith(f"/{pid}") or ref.endswith(f":{pid}")
                ):
                    timeline.append(resumir_agendamento(ag, lookup))
                    break
            else:
                continue
            break

    # ordena por data de início (asc)
    timeline.sort(key=lambda x: x.get("inicio") or "", reverse=False)

    # 4. Diff (se há A e B)
    versao_a = next((v["resumo"] for v in versoes if v["origem"] == "sistema_a"), None)
    versao_b = next((v["resumo"] for v in versoes if v["origem"] == "sistema_b"), None)
    diff = _compute_diff(versao_a, versao_b)

    return {
        "encontrado_em": [v["origem"] for v in versoes],
        "versoes": versoes,
        "agendamentos": timeline,
        "diff": diff,
        "duplicado": len(versoes) > 1,
    }


def _matches_prof(prof_resource: dict, identifier: str | None, nome: str | None) -> bool:
    if identifier:
        ident = identifier.strip()
        crm = _identifier_value(prof_resource, CRM_SYSTEM)
        if crm == ident:
            return True
        if str(prof_resource.get("id")) == ident:
            return True
        return False
    if nome:
        nm = nome.strip().lower()
        for n in prof_resource.get("name", []) or []:
            if nm in (n.get("text") or "").lower():
                return True
    return False


def _compute_diff_prof(a: dict | None, b: dict | None) -> list[dict]:
    if not a or not b:
        return []
    campos = [
        ("Nome", "nome"), ("CRM", "crm"), ("Especialidade", "especialidade"),
        ("Telefone", "telefone"), ("E-mail", "email"),
    ]
    saida = []
    for label, key in campos:
        va = a.get(key)
        vb = b.get(key)
        igual = (va or "").strip().lower() == (vb or "").strip().lower() if (va and vb) else (va == vb)
        saida.append({"campo": label, "a": va, "b": vb, "igual": bool(igual)})
    return saida


@router.get("/profissionais/detalhe")
async def detalhe_profissional(
    identifier: str | None = Query(None, description="CRM ou ID interno"),
    nome: str | None = Query(None, description="busca por substring de nome"),
):
    if not (identifier or nome):
        raise HTTPException(status_code=400, detail="Informe identifier ou nome.")

    try:
        entries = await coletar_entries(origem="ambos")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    profissionais_entries = filtrar_por_tipo(entries, "Practitioner")
    matches = [e for e in profissionais_entries if _matches_prof(e["resource"], identifier, nome)]
    if not matches:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")

    versoes = []
    chaves_prof: set[tuple[str, str]] = set()
    for e in matches:
        r = e["resource"]
        origem = _origem(r) or "?"
        resumo = resumir_profissional(r)
        versoes.append({
            "origem": origem,
            "id": r.get("id"),
            "resumo": resumo,
            "fhir": r,
        })
        chaves_prof.add((origem, str(r.get("id"))))

    lookup = construir_lookup(entries)
    agendamentos_entries = filtrar_por_tipo(entries, "Appointment")
    timeline = []
    for ae in agendamentos_entries:
        ag = ae["resource"]
        ag_origem = _origem(ag) or "?"
        for p in ag.get("participant", []) or []:
            ref = (p.get("actor") or {}).get("reference") or ""
            for orig, pid in chaves_prof:
                if orig == ag_origem and (
                    ref.endswith(f"/{pid}") or ref.endswith(f":{pid}")
                ):
                    timeline.append(resumir_agendamento(ag, lookup))
                    break
            else:
                continue
            break

    timeline.sort(key=lambda x: x.get("inicio") or "", reverse=False)

    versao_a = next((v["resumo"] for v in versoes if v["origem"] == "sistema_a"), None)
    versao_b = next((v["resumo"] for v in versoes if v["origem"] == "sistema_b"), None)
    diff = _compute_diff_prof(versao_a, versao_b)

    return {
        "encontrado_em": [v["origem"] for v in versoes],
        "versoes": versoes,
        "agendamentos": timeline,
        "diff": diff,
        "duplicado": len(versoes) > 1,
    }


@router.get("/agendamentos/detalhe")
async def detalhe_agendamento(
    id: str = Query(..., description="ID interno do agendamento"),
    origem: str = Query(..., description="Origem do agendamento (sistema_a ou sistema_b)"),
):
    try:
        entries = await coletar_entries(origem=origem)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    agendamentos_entries = filtrar_por_tipo(entries, "Appointment")
    
    match = None
    for e in agendamentos_entries:
        r = e["resource"]
        ag_origem = _origem(r) or "?"
        if ag_origem == origem and str(r.get("id")) == str(id):
            match = r
            break
            
    if not match:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    lookup = construir_lookup(entries)
    resumo = resumir_agendamento(match, lookup)
    
    versoes = [{
        "origem": origem,
        "id": match.get("id"),
        "resumo": resumo,
        "fhir": match,
    }]

    return {
        "encontrado_em": [origem],
        "versoes": versoes,
        "agendamentos": [],
        "diff": [],
        "duplicado": False,
    }
