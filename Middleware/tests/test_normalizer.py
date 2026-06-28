"""Testes do normalizer FHIR.

Cobertura focada nos bugs corrigidos: resolução de participants com `urn:uuid:`,
identifiers casados por `system` (CNS/CPF/CRM) e dedup cross-sistema.

Rodar: `python -m pytest tests/ -v` a partir de `Middleware/`.
"""
from app.fhir.normalizer import (
    CNS_SYSTEM,
    CPF_SYSTEM,
    CRM_SYSTEM,
    construir_lookup,
    deduplicar_pacientes,
    deduplicar_profissionais,
    extrair_recursos,
    filtrar_appointment,
    filtrar_por_tipo,
    resumir_agendamento,
    resumir_paciente,
    resumir_profissional,
)


# ─────────────────────────────────────────────────────────────────────────────
# resumir_paciente / resumir_profissional — identifiers por system
# ─────────────────────────────────────────────────────────────────────────────


def test_resumir_paciente_extrai_cns_cpf_por_system():
    """O CNS/CPF deve sair do identifier cujo `system` bate, não por substring."""
    patient = {
        "resourceType": "Patient",
        "id": "p1",
        "name": [{"text": "Maria"}],
        "gender": "female",
        "birthDate": "1990-01-01",
        "identifier": [
            {"system": CNS_SYSTEM, "value": "700000000000001"},
            {"system": CPF_SYSTEM, "value": "12345678900"},
            {"system": "http://outro/sistema", "value": "ignorar"},
        ],
        "telecom": [{"system": "phone", "value": "11999"}],
    }
    r = resumir_paciente(patient)
    assert r["cartao_sus"] == "700000000000001"
    assert r["cpf"] == "12345678900"
    assert r["nome"] == "Maria"
    assert r["telefone"] == "11999"


def test_resumir_profissional_extrai_crm_por_system():
    """CRM tem que sair do system CRM, e a especialidade do qualification.code.text."""
    practitioner = {
        "resourceType": "Practitioner",
        "id": "pr1",
        "name": [{"text": "Dr. House"}],
        "identifier": [{"system": CRM_SYSTEM, "value": "12345-NY"}],
        "qualification": [{"code": {"text": "Diagnóstico"}}],
    }
    r = resumir_profissional(practitioner)
    assert r["crm"] == "12345-NY"
    assert r["especialidade"] == "Diagnóstico"


# ─────────────────────────────────────────────────────────────────────────────
# resumir_agendamento — bug central que estava preenchendo profissional/local null
# ─────────────────────────────────────────────────────────────────────────────


def test_resumir_agendamento_resolve_urn_uuid_pelo_lookup():
    """Sistema B emite participants com `reference: urn:uuid:...` — devem ser
    resolvidos via o mapa fullUrl → resourceType construído pelo agregador.
    """
    bundle = {
        "resourceType": "Bundle",
        "entry": [
            {
                "fullUrl": "urn:uuid:pat-1",
                "resource": {"resourceType": "Patient", "id": "1", "name": [{"text": "Maria"}]},
            },
            {
                "fullUrl": "urn:uuid:prac-1",
                "resource": {"resourceType": "Practitioner", "id": "2", "name": [{"text": "Dr. House"}]},
            },
            {
                "fullUrl": "urn:uuid:loc-1",
                "resource": {"resourceType": "Location", "id": "3", "name": "UBS Centro"},
            },
            {
                "fullUrl": "urn:uuid:app-1",
                "resource": {
                    "resourceType": "Appointment",
                    "id": "9",
                    "status": "booked",
                    "start": "2026-01-01T10:00:00-03:00",
                    "end":   "2026-01-01T10:30:00-03:00",
                    "appointmentType": {"text": "PRESENCIAL"},
                    "participant": [
                        {"actor": {"reference": "urn:uuid:pat-1",  "display": "Maria"},     "status": "accepted"},
                        {"actor": {"reference": "urn:uuid:prac-1", "display": "Dr. House"}, "status": "accepted"},
                        {"actor": {"reference": "urn:uuid:loc-1",  "display": "UBS Centro"},"status": "accepted"},
                    ],
                },
            },
        ],
    }
    entries = extrair_recursos(bundle, origem="sistema_b")
    lookup = construir_lookup(entries)
    appts = filtrar_por_tipo(entries, "Appointment")
    resumo = resumir_agendamento(appts[0]["resource"], lookup)

    assert resumo["paciente"]     == "Maria"
    assert resumo["profissional"] == "Dr. House"
    assert resumo["local"]        == "UBS Centro"
    assert resumo["status"]       == "booked"
    assert resumo["tipo"]         == "PRESENCIAL"


def test_resumir_agendamento_resolve_referencia_literal_patient_slash():
    """Sistema A emite `Patient/123`, `Practitioner/456`, `Location/789` —
    devem continuar funcionando mesmo sem lookup."""
    appointment = {
        "resourceType": "Appointment",
        "id": "x",
        "status": "booked",
        "participant": [
            {"actor": {"reference": "Patient/1",      "display": "João"}},
            {"actor": {"reference": "Practitioner/2", "display": "Dra. Ana"}},
            {"actor": {"reference": "Location/3",    "display": "Clínica Central"}},
        ],
    }
    r = resumir_agendamento(appointment, lookup=None)
    assert r["paciente"] == "João"
    assert r["profissional"] == "Dra. Ana"
    assert r["local"] == "Clínica Central"


def test_resumir_agendamento_fallback_para_paciente_quando_tipo_desconhecido():
    """Se não há lookup e a reference não bate em prefixo conhecido,
    o primeiro display vira o paciente (compatibilidade com bundles antigos)."""
    appointment = {
        "resourceType": "Appointment",
        "participant": [
            {"actor": {"reference": "urn:foo:bar", "display": "Talvez paciente"}},
        ],
    }
    r = resumir_agendamento(appointment, lookup={})
    assert r["paciente"] == "Talvez paciente"
    assert r["profissional"] is None
    assert r["local"] is None


# ─────────────────────────────────────────────────────────────────────────────
# extrair_recursos / construir_lookup — base do pipeline
# ─────────────────────────────────────────────────────────────────────────────


def test_extrair_recursos_marca_origem():
    bundle = {
        "resourceType": "Bundle",
        "entry": [
            {"fullUrl": "urn:uuid:p1", "resource": {"resourceType": "Patient", "id": "1"}},
        ],
    }
    entries = extrair_recursos(bundle, origem="sistema_a")
    tags = entries[0]["resource"]["meta"]["tag"]
    assert any(t["code"] == "sistema_a" for t in tags)


def test_construir_lookup_mapeia_fullurl_para_tipo():
    entries = [
        {"fullUrl": "urn:uuid:a", "resource": {"resourceType": "Patient"}},
        {"fullUrl": "urn:uuid:b", "resource": {"resourceType": "Practitioner"}},
        {"fullUrl": None,         "resource": {"resourceType": "Location"}},   # sem fullUrl: ignorado
    ]
    lookup = construir_lookup(entries)
    assert lookup == {"urn:uuid:a": "Patient", "urn:uuid:b": "Practitioner"}


# ─────────────────────────────────────────────────────────────────────────────
# Dedup cross-sistema
# ─────────────────────────────────────────────────────────────────────────────


def test_deduplicar_pacientes_pelo_cns():
    """Mesmo CNS em A e B → 1 entry de saída, com tags de ambas as origens."""
    a = {
        "fullUrl": "urn:uuid:a-p1",
        "resource": {
            "resourceType": "Patient", "id": "1",
            "identifier": [{"system": CNS_SYSTEM, "value": "700000000000001"}],
            "meta": {"tag": [{"system": "http://middleware.interop/source", "code": "sistema_a"}]},
        },
    }
    b = {
        "fullUrl": "urn:uuid:b-p1",
        "resource": {
            "resourceType": "Patient", "id": "2",
            "identifier": [{"system": CNS_SYSTEM, "value": "700000000000001"}],
            "meta": {"tag": [{"system": "http://middleware.interop/source", "code": "sistema_b"}]},
        },
    }
    dedup = deduplicar_pacientes([a, b])
    assert len(dedup) == 1
    tags = dedup[0]["resource"]["meta"]["tag"]
    codes = {t["code"] for t in tags}
    assert codes == {"sistema_a", "sistema_b"}


def test_deduplicar_profissionais_pelo_crm():
    a = {"fullUrl": "u:a", "resource": {
        "resourceType": "Practitioner", "id": "1",
        "identifier": [{"system": CRM_SYSTEM, "value": "12345-PI"}],
    }}
    b = {"fullUrl": "u:b", "resource": {
        "resourceType": "Practitioner", "id": "2",
        "identifier": [{"system": CRM_SYSTEM, "value": "12345-PI"}],
    }}
    assert len(deduplicar_profissionais([a, b])) == 1


def test_deduplicar_preserva_sem_identifier_conhecido():
    """Recursos sem CNS/CPF passam direto (não tem chave de dedup)."""
    sem_id_a = {"fullUrl": "u:a", "resource": {"resourceType": "Patient", "id": "1"}}
    sem_id_b = {"fullUrl": "u:b", "resource": {"resourceType": "Patient", "id": "2"}}
    assert len(deduplicar_pacientes([sem_id_a, sem_id_b])) == 2


# ─────────────────────────────────────────────────────────────────────────────
# Filtros
# ─────────────────────────────────────────────────────────────────────────────


def test_filtrar_appointment_por_status_e_data():
    entries = [
        {"resource": {"resourceType": "Appointment", "status": "booked",    "start": "2026-01-10T10:00:00"}},
        {"resource": {"resourceType": "Appointment", "status": "cancelled", "start": "2026-01-20T10:00:00"}},
        {"resource": {"resourceType": "Appointment", "status": "booked",    "start": "2026-02-15T10:00:00"}},
    ]
    so_booked = filtrar_appointment(entries, status="booked", date_ge=None, date_le=None)
    assert len(so_booked) == 2

    no_intervalo = filtrar_appointment(entries, status=None, date_ge="2026-01-15", date_le="2026-02-01")
    assert len(no_intervalo) == 1
    assert no_intervalo[0]["resource"]["status"] == "cancelled"
