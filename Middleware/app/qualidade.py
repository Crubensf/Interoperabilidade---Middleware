"""Detecção de problemas de qualidade de dados nos recursos FHIR coletados."""
from app.fhir.normalizer import (
    CNS_SYSTEM,
    CPF_SYSTEM,
    CRM_SYSTEM,
    SOURCE_TAG_SYSTEM,
    _identifier_value,
)


def _origem(resource: dict) -> str | None:
    for t in (resource.get("meta") or {}).get("tag", []) or []:
        if t.get("system") == SOURCE_TAG_SYSTEM:
            return t.get("code")
    return None


def analisar_qualidade(entries: list[dict]) -> dict:
    """Retorna um relatório com alertas por categoria."""
    pacientes_sem_cns = []
    pacientes_sem_cpf = []
    profissionais_sem_crm = []
    profissionais_crm_invalido = []
    agendamentos_sem_local = []
    agendamentos_status_invalido = []

    STATUS_FHIR_VALIDOS = {
        "proposed", "pending", "booked", "arrived", "fulfilled",
        "cancelled", "noshow", "entered-in-error", "checked-in", "waitlist",
    }

    for e in entries:
        r = e.get("resource") or {}
        rt = r.get("resourceType")
        origem = _origem(r)

        if rt == "Patient":
            nome = (r.get("name") or [{}])[0].get("text") or "?"
            if not _identifier_value(r, CNS_SYSTEM):
                pacientes_sem_cns.append({"id": r.get("id"), "nome": nome, "origem": origem})
            if not _identifier_value(r, CPF_SYSTEM):
                pacientes_sem_cpf.append({"id": r.get("id"), "nome": nome, "origem": origem})

        elif rt == "Practitioner":
            nome = (r.get("name") or [{}])[0].get("text") or "?"
            crm = _identifier_value(r, CRM_SYSTEM)
            if not crm:
                profissionais_sem_crm.append({"id": r.get("id"), "nome": nome, "origem": origem})
            elif not _crm_valido(crm):
                profissionais_crm_invalido.append({"id": r.get("id"), "nome": nome, "crm": crm, "origem": origem})

        elif rt == "Appointment":
            tem_local = any(
                "Location" in (p.get("actor", {}).get("reference") or "")
                for p in r.get("participant", []) or []
            )
            if not tem_local:
                agendamentos_sem_local.append({"id": r.get("id"), "origem": origem})
            st = (r.get("status") or "").lower()
            if st and st not in STATUS_FHIR_VALIDOS:
                agendamentos_status_invalido.append({"id": r.get("id"), "status": st, "origem": origem})

    return {
        "pacientes_sem_cns": pacientes_sem_cns,
        "pacientes_sem_cpf": pacientes_sem_cpf,
        "profissionais_sem_crm": profissionais_sem_crm,
        "profissionais_crm_invalido": profissionais_crm_invalido,
        "agendamentos_sem_local": agendamentos_sem_local,
        "agendamentos_status_invalido": agendamentos_status_invalido,
        "totais": {
            "pacientes_sem_cns": len(pacientes_sem_cns),
            "pacientes_sem_cpf": len(pacientes_sem_cpf),
            "profissionais_sem_crm": len(profissionais_sem_crm),
            "profissionais_crm_invalido": len(profissionais_crm_invalido),
            "agendamentos_sem_local": len(agendamentos_sem_local),
            "agendamentos_status_invalido": len(agendamentos_status_invalido),
        },
    }


def _crm_valido(crm: str) -> bool:
    # Aceita "SP123456" (UF + dígitos) ou só dígitos.
    if not crm:
        return False
    s = crm.strip().upper()
    if s.isdigit():
        return len(s) >= 3
    if len(s) >= 5 and s[:2].isalpha() and s[2:].isdigit():
        return True
    return False


def listar_duplicatas(entries: list[dict]) -> dict:
    """Identifica recursos que aparecem em A e B (sem mesclar)."""
    pacientes_por_chave: dict[tuple, list[dict]] = {}
    profissionais_por_chave: dict[tuple, list[dict]] = {}

    for e in entries:
        r = e.get("resource") or {}
        origem = _origem(r)
        if not origem:
            continue
        nome = (r.get("name") or [{}])[0].get("text") or "?"

        if r.get("resourceType") == "Patient":
            chave = None
            for sys_url in (CNS_SYSTEM, CPF_SYSTEM):
                v = _identifier_value(r, sys_url)
                if v:
                    chave = (sys_url.rsplit("/", 1)[-1], v)
                    break
            if chave:
                pacientes_por_chave.setdefault(chave, []).append({"id": r.get("id"), "nome": nome, "origem": origem})

        elif r.get("resourceType") == "Practitioner":
            v = _identifier_value(r, CRM_SYSTEM)
            if v:
                chave = ("crm", v)
                profissionais_por_chave.setdefault(chave, []).append({"id": r.get("id"), "nome": nome, "origem": origem})

    pac_dups = [
        {"identificador": k, "ocorrencias": v}
        for k, v in pacientes_por_chave.items()
        if len({o["origem"] for o in v}) > 1
    ]
    prof_dups = [
        {"identificador": k, "ocorrencias": v}
        for k, v in profissionais_por_chave.items()
        if len({o["origem"] for o in v}) > 1
    ]

    return {
        "pacientes": pac_dups,
        "profissionais": prof_dups,
        "totais": {"pacientes": len(pac_dups), "profissionais": len(prof_dups)},
    }
