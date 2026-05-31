from __future__ import annotations

import uuid
from copy import deepcopy

from app.serializadores_fhir.agendamento import agendamento_para_fhir
from app.serializadores_fhir.local import local_para_fhir
from app.serializadores_fhir.paciente import paciente_para_fhir
from app.serializadores_fhir.profissional import profissional_para_fhir


def _to_urn(rest_reference: str) -> str:
    return f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, rest_reference)}"


def _normalize_rest_reference(reference: str) -> str:
    if not isinstance(reference, str) or not reference.strip():
        raise ValueError("Referência interna inválida no Appointment.participant.actor.")

    ref = reference.strip().strip("/")
    if ref.startswith("urn:uuid:"):
        return ref

    parts = ref.split("/")
    if len(parts) < 2:
        raise ValueError(
            "Referência interna inválida no Appointment.participant.actor. "
            "Use ResourceType/id."
        )

    return f"{parts[-2]}/{parts[-1]}"


def _set_urn_references_in_appointment(appointment: dict, rest_to_urn: dict[str, str]) -> None:
    for participant in appointment.get("participant", []):
        actor = participant.get("actor")
        if not isinstance(actor, dict):
            continue

        reference = actor.get("reference")
        if not isinstance(reference, str):
            continue

        normalized_ref = _normalize_rest_reference(reference)
        if normalized_ref.startswith("urn:uuid:"):
            continue

        urn = rest_to_urn.get(normalized_ref)
        if not urn:
            raise ValueError(f"Referência interna não encontrada no bundle: {normalized_ref}")

        actor["reference"] = urn


def _build_entry(resource: dict, rest_reference: str, rest_to_urn: dict[str, str]) -> dict:
    urn = rest_to_urn.setdefault(rest_reference, _to_urn(rest_reference))
    resource_with_urn_id = deepcopy(resource)
    resource_with_urn_id["id"] = urn.replace("urn:uuid:", "", 1)
    return {
        "fullUrl": urn,
        "resource": resource_with_urn_id,
        "request": {
            "method": "POST",
            "url": resource["resourceType"],
        },
    }


def _assert_valid_transaction(bundle: dict) -> None:
    if bundle.get("resourceType") != "Bundle" or bundle.get("type") != "transaction":
        raise ValueError("Bundle transacional inválido.")

    entries = bundle.get("entry")
    if not isinstance(entries, list) or not entries:
        raise ValueError("Bundle transacional sem entries.")

    full_urls = {
        entry.get("fullUrl")
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("fullUrl"), str)
    }

    for i, entry in enumerate(entries):
        request = entry.get("request")
        resource = entry.get("resource")
        full_url = entry.get("fullUrl")
        if not isinstance(request, dict):
            raise ValueError(f"entry[{i}] sem request.")
        if request.get("method") != "POST":
            raise ValueError(f"entry[{i}] request.method inválido.")
        if not isinstance(resource, dict):
            raise ValueError(f"entry[{i}] sem resource.")
        if request.get("url") != resource.get("resourceType"):
            raise ValueError(f"entry[{i}] request.url inválido.")
        if not isinstance(full_url, str) or not full_url.startswith("urn:uuid:"):
            raise ValueError(f"entry[{i}] fullUrl inválido.")

        if resource.get("resourceType") == "Appointment":
            for participant in resource.get("participant", []):
                actor = participant.get("actor")
                reference = actor.get("reference") if isinstance(actor, dict) else None
                if not isinstance(reference, str) or not reference.startswith("urn:uuid:"):
                    raise ValueError("Appointment.participant.actor.reference inválido.")
                if reference not in full_urls:
                    raise ValueError(
                        "Appointment.participant.actor.reference sem entry correspondente."
                    )


def _montar_bundle_transacao_por_recursos(resources: list[dict]) -> dict:
    rest_to_urn: dict[str, str] = {}
    entries = []

    for resource in resources:
        rest_ref = f"{resource['resourceType']}/{resource['id']}"
        entries.append(_build_entry(resource, rest_ref, rest_to_urn))

    for entry in entries:
        resource = entry.get("resource")
        if isinstance(resource, dict) and resource.get("resourceType") == "Appointment":
            _set_urn_references_in_appointment(resource, rest_to_urn)

    bundle = {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": entries,
    }
    _assert_valid_transaction(bundle)
    return bundle


def montar_bundle_agendamento(a):
    if not all([a.paciente, a.profissional, a.local, a.especialidade]):
        raise ValueError("Agendamento sem relacionamentos obrigatórios para gerar Bundle.")

    resources = [
        paciente_para_fhir(a.paciente, for_bundle=True),
        profissional_para_fhir(
            a.profissional,
            for_bundle=True,
            qualification_text=getattr(a.especialidade, "nome", None),
        ),
        local_para_fhir(a.local, for_bundle=True),
        agendamento_para_fhir(a, for_bundle=True),
    ]
    return _montar_bundle_transacao_por_recursos(resources)


def montar_bundle_geral_transacao(
    pacientes,
    profissionais,
    agendamentos,
    locais,
):
    resources = []
    for p in pacientes or []:
        resources.append(paciente_para_fhir(p, for_bundle=True))
    for prof in profissionais or []:
        resources.append(profissional_para_fhir(prof, for_bundle=True))
    for loc in locais or []:
        resources.append(local_para_fhir(loc, for_bundle=True))
    for ag in agendamentos or []:
        resources.append(agendamento_para_fhir(ag, for_bundle=True))

    return _montar_bundle_transacao_por_recursos(resources)
