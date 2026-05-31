from app.serializadores_fhir.common import (
    CRM_NAMING_SYSTEM,
    IDENTIFIER_TYPE_CRM,
    normalize_crm,
)


def _resolve_qualification_text(prof, qualification_text: str | None = None) -> str | None:
    if qualification_text:
        return qualification_text

    especialidade = getattr(prof, "especialidade", None)
    if especialidade is None:
        return None

    return getattr(especialidade, "nome", None)


def profissional_para_fhir(
    prof,
    *,
    for_bundle: bool = False,
    qualification_text: str | None = None,
):
    resource = {
        "resourceType": "Practitioner",
        "id": str(prof.id),
        "name": [{"text": prof.nome}],
    }

    crm_value = (
        normalize_crm(getattr(prof, "crm", None), getattr(prof, "crm_uf", None))
        if for_bundle
        else getattr(prof, "crm", None)
    )
    if crm_value:
        resource["identifier"] = [
            {
                "use": "official",
                "type": IDENTIFIER_TYPE_CRM,
                "system": CRM_NAMING_SYSTEM,
                "value": crm_value,
            }
        ]

    telecom = []
    if getattr(prof, "telefone", None):
        telecom.append(
            {
                "system": "phone",
                "value": prof.telefone,
                "use": "work",
            }
        )
    if getattr(prof, "email", None):
        telecom.append(
            {
                "system": "email",
                "value": prof.email,
                "use": "work",
            }
        )
    if telecom:
        resource["telecom"] = telecom

    qualification_name = _resolve_qualification_text(
        prof, qualification_text=qualification_text
    )
    if qualification_name:
        resource["qualification"] = [
            {
                "code": {
                    "text": qualification_name,
                }
            }
        ]

    return resource
