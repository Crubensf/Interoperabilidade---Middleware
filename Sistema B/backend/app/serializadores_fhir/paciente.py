from app.serializadores_fhir.common import (
    CNS_NAMING_SYSTEM,
    CPF_NAMING_SYSTEM,
    IDENTIFIER_TYPE_CNS,
    IDENTIFIER_TYPE_CPF,
    MOTHERS_MAIDEN_NAME_URL,
    normalize_cns,
    normalize_cpf,
    normalize_gender,
)


def paciente_para_fhir(p, *, for_bundle: bool = False):
    identifiers = []
    cpf_value = (
        normalize_cpf(getattr(p, "cpf", None))
        if for_bundle
        else getattr(p, "cpf", None)
    )
    cns_value = (
        normalize_cns(getattr(p, "cartao_sus", None))
        if for_bundle
        else getattr(p, "cartao_sus", None)
    )

    if cpf_value:
        identifiers.append(
            {
                "use": "official",
                "type": IDENTIFIER_TYPE_CPF,
                "system": CPF_NAMING_SYSTEM if for_bundle else "https://gov.br/cpf",
                "value": cpf_value,
            }
        )

    if cns_value:
        identifiers.append(
            {
                "use": "official",
                "type": IDENTIFIER_TYPE_CNS,
                "system": CNS_NAMING_SYSTEM
                if for_bundle
                else "https://saude.gov.br/sus/cartao",
                "value": cns_value,
            }
        )

    resource = {
        "resourceType": "Patient",
        "id": str(p.id),
        "identifier": identifiers,
        "name": [
            {
                "use": "official",
                "text": p.nome,
            }
        ],
    }

    telecom = []
    if getattr(p, "telefone", None):
        telecom.append(
            {
                "system": "phone",
                "value": p.telefone,
                "use": "mobile",
            }
        )
    if getattr(p, "email", None):
        telecom.append(
            {
                "system": "email",
                "value": p.email,
                "use": "home",
            }
        )
    if telecom:
        resource["telecom"] = telecom

    gender = normalize_gender(getattr(p, "gender", None) or getattr(p, "sexo", None))
    if gender:
        resource["gender"] = gender

    if getattr(p, "data_nascimento", None):
        resource["birthDate"] = p.data_nascimento.isoformat()

    address = {
        "country": "BR",
    }
    if getattr(p, "endereco", None):
        address["text"] = p.endereco
    if getattr(p, "municipio", None):
        address["city"] = p.municipio
    if len(address) > 1:
        resource["address"] = [address]

    if getattr(p, "nome_mae", None):
        resource["extension"] = [
            {
                "url": MOTHERS_MAIDEN_NAME_URL,
                "valueString": p.nome_mae,
            }
        ]

    return resource
