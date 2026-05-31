def _resolve_location_status(local) -> str | None:
    raw_status = getattr(local, "status", None)
    if isinstance(raw_status, str):
        normalized = raw_status.strip().lower()
        if normalized in {"active", "inactive", "suspended"}:
            return normalized

    if hasattr(local, "ativo"):
        return "active" if bool(getattr(local, "ativo")) else "inactive"

    return None


def local_para_fhir(l, *, for_bundle: bool = False):
    resource = {
        "resourceType": "Location",
        "id": str(l.id),
        "name": l.nome,
        "address": {
            "line": [l.endereco] if l.endereco else [],
            "city": l.municipio,
            "country": "BR",
        },
    }

    status = _resolve_location_status(l)
    if status:
        resource["status"] = status

    return resource
