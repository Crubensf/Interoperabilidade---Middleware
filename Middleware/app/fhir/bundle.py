from datetime import datetime, timezone


def montar_bundle_unificado(entries: list[dict]) -> dict:
    """Monta um Bundle FHIR R4 do tipo 'collection' agregando recursos dos dois sistemas."""
    return {
        "resourceType": "Bundle",
        "type": "collection",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total": len(entries),
        "entry": entries,
    }
