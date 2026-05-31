from typing import Iterable


SOURCE_TAG_SYSTEM = "http://middleware.interop/source"


def _tag_origem(resource: dict, origem: str) -> dict:
    """Adiciona uma meta.tag indicando a origem (sistema_a | sistema_b) ao recurso FHIR."""
    meta = resource.setdefault("meta", {})
    tags = meta.setdefault("tag", [])
    if not any(t.get("system") == SOURCE_TAG_SYSTEM for t in tags):
        tags.append({"system": SOURCE_TAG_SYSTEM, "code": origem, "display": f"Origem: {origem}"})
    return resource


def extrair_recursos(bundle: dict, origem: str) -> list[dict]:
    """Extrai recursos de um Bundle FHIR e marca a origem em meta.tag.

    Retorna lista de dicts no formato {fullUrl, resource}.
    """
    if not bundle or bundle.get("resourceType") != "Bundle":
        return []

    saida: list[dict] = []
    for entry in bundle.get("entry", []) or []:
        recurso = entry.get("resource")
        if not isinstance(recurso, dict):
            continue
        _tag_origem(recurso, origem)
        saida.append({
            "fullUrl": entry.get("fullUrl") or _gerar_full_url(recurso, origem),
            "resource": recurso,
        })
    return saida


def _gerar_full_url(recurso: dict, origem: str) -> str:
    rid = recurso.get("id") or "sem-id"
    rtype = recurso.get("resourceType", "Resource")
    return f"urn:uuid:{origem}-{rtype}-{rid}"


def filtrar_por_tipo(entries: Iterable[dict], resource_type: str) -> list[dict]:
    return [e for e in entries if e.get("resource", {}).get("resourceType") == resource_type]


def resumir_paciente(resource: dict) -> dict:
    """Resumo legível de Patient para a API REST unificada."""
    name = (resource.get("name") or [{}])[0]
    identifiers = {i.get("system", ""): i.get("value") for i in resource.get("identifier", []) or []}
    telecom = {t.get("system"): t.get("value") for t in resource.get("telecom", []) or []}
    return {
        "id": resource.get("id"),
        "origem": _origem(resource),
        "nome": name.get("text") or " ".join(name.get("given", []) + [name.get("family", "")]).strip(),
        "sexo": resource.get("gender"),
        "data_nascimento": resource.get("birthDate"),
        "cpf": _achar_por_substring(identifiers, "cpf"),
        "cartao_sus": _achar_por_substring(identifiers, "cns"),
        "telefone": telecom.get("phone"),
        "email": telecom.get("email"),
    }


def resumir_profissional(resource: dict) -> dict:
    name = (resource.get("name") or [{}])[0]
    identifiers = {i.get("system", ""): i.get("value") for i in resource.get("identifier", []) or []}
    telecom = {t.get("system"): t.get("value") for t in resource.get("telecom", []) or []}
    qualif = resource.get("qualification") or []
    especialidade = None
    if qualif:
        code = qualif[0].get("code") or {}
        especialidade = code.get("text") or (code.get("coding") or [{}])[0].get("display")
    return {
        "id": resource.get("id"),
        "origem": _origem(resource),
        "nome": name.get("text") or " ".join(name.get("given", []) + [name.get("family", "")]).strip(),
        "crm": _achar_por_substring(identifiers, "crm"),
        "especialidade": especialidade,
        "telefone": telecom.get("phone"),
        "email": telecom.get("email"),
    }


def resumir_agendamento(resource: dict) -> dict:
    participants = resource.get("participant", []) or []
    paciente_ref = profissional_ref = local_ref = None
    for p in participants:
        actor = p.get("actor") or {}
        ref = actor.get("reference") or ""
        display = actor.get("display")
        if "Patient" in ref or (display and paciente_ref is None and "Practitioner" not in ref and "Location" not in ref):
            paciente_ref = paciente_ref or display
        if "Practitioner" in ref:
            profissional_ref = display
        if "Location" in ref:
            local_ref = display

    appt_type = resource.get("appointmentType") or {}
    return {
        "id": resource.get("id"),
        "origem": _origem(resource),
        "status": resource.get("status"),
        "inicio": resource.get("start"),
        "fim": resource.get("end"),
        "tipo": appt_type.get("text") or (appt_type.get("coding") or [{}])[0].get("display"),
        "descricao": resource.get("description"),
        "paciente": paciente_ref,
        "profissional": profissional_ref,
        "local": local_ref,
    }


def _origem(resource: dict) -> str | None:
    for t in (resource.get("meta") or {}).get("tag", []) or []:
        if t.get("system") == SOURCE_TAG_SYSTEM:
            return t.get("code")
    return None


def _achar_por_substring(d: dict, substr: str) -> str | None:
    for k, v in d.items():
        if substr.lower() in (k or "").lower():
            return v
    return None


# =====================================================================
# De-duplicação cross-sistema
# =====================================================================

CNS_SYSTEM = "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cns"
CPF_SYSTEM = "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf"
CRM_SYSTEM = "http://rnds.saude.gov.br/fhir/r4/NamingSystem/crm"


def _identifier_value(resource: dict, system: str) -> str | None:
    for ident in resource.get("identifier", []) or []:
        if (ident.get("system") or "").rstrip("/") == system.rstrip("/"):
            val = ident.get("value")
            if val:
                return str(val).strip()
    return None


def _merge_origens(destino: dict, fonte: dict) -> None:
    meta_d = destino.setdefault("meta", {})
    tags_d = meta_d.setdefault("tag", [])
    existentes = {(t.get("system"), t.get("code")) for t in tags_d}
    for t in (fonte.get("meta") or {}).get("tag", []) or []:
        chave = (t.get("system"), t.get("code"))
        if chave not in existentes:
            tags_d.append(t)
            existentes.add(chave)


def deduplicar_por_identifier(entries: list[dict], systems: list[str]) -> list[dict]:
    """Mescla entries que compartilham o mesmo identifier para qualquer um dos systems dados.

    Estratégia: o primeiro encontrado vence; subsequentes só agregam meta.tag de origem.
    Recursos sem nenhum identifier conhecido passam direto.
    """
    por_chave: dict[tuple[str, str], dict] = {}
    saida: list[dict] = []

    for entry in entries:
        recurso = entry.get("resource") or {}
        chave = None
        for sys_url in systems:
            val = _identifier_value(recurso, sys_url)
            if val:
                chave = (sys_url, val)
                break

        if chave is None:
            saida.append(entry)
            continue

        if chave in por_chave:
            _merge_origens(por_chave[chave]["resource"], recurso)
        else:
            por_chave[chave] = entry
            saida.append(entry)

    return saida


def deduplicar_pacientes(entries: list[dict]) -> list[dict]:
    return deduplicar_por_identifier(entries, [CNS_SYSTEM, CPF_SYSTEM])


def deduplicar_profissionais(entries: list[dict]) -> list[dict]:
    return deduplicar_por_identifier(entries, [CRM_SYSTEM])


# =====================================================================
# Search params FHIR (filtragem em memória sobre os recursos coletados)
# =====================================================================

def _str_match(haystack: str | None, needle: str) -> bool:
    if not haystack:
        return False
    return needle.lower() in str(haystack).lower()


def filtrar_patient(entries: list[dict], *, identifier: str | None, name: str | None) -> list[dict]:
    saida = []
    for e in entries:
        r = e.get("resource") or {}
        if identifier:
            valores = [i.get("value") for i in r.get("identifier", []) or []]
            if identifier not in [v for v in valores if v]:
                continue
        if name:
            nomes = []
            for n in r.get("name", []) or []:
                nomes.append(n.get("text") or "")
                nomes.extend(n.get("given", []) or [])
                nomes.append(n.get("family") or "")
            if not any(_str_match(x, name) for x in nomes):
                continue
        saida.append(e)
    return saida


def filtrar_practitioner(entries: list[dict], *, identifier: str | None, name: str | None) -> list[dict]:
    return filtrar_patient(entries, identifier=identifier, name=name)


def filtrar_appointment(
    entries: list[dict],
    *,
    status: str | None,
    date_ge: str | None,
    date_le: str | None,
) -> list[dict]:
    saida = []
    for e in entries:
        r = e.get("resource") or {}
        if status and (r.get("status") or "").lower() != status.lower():
            continue
        inicio = r.get("start") or ""
        if date_ge and inicio < date_ge:
            continue
        if date_le and inicio and inicio > date_le:
            continue
        saida.append(e)
    return saida


def paginar(entries: list[dict], offset: int, count: int) -> tuple[list[dict], int]:
    total = len(entries)
    return entries[offset : offset + count], total
