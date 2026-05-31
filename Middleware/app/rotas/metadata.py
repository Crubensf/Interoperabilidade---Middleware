from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["FHIR Meta"])


def _capability_statement() -> dict:
    return {
        "resourceType": "CapabilityStatement",
        "status": "active",
        "date": datetime.now(timezone.utc).isoformat(),
        "publisher": "Middleware de Interoperabilidade",
        "kind": "instance",
        "software": {"name": "middleware-interop", "version": "0.2.0"},
        "fhirVersion": "4.0.1",
        "format": ["application/fhir+json", "json"],
        "rest": [
            {
                "mode": "server",
                "resource": [
                    {
                        "type": "Patient",
                        "interaction": [{"code": "read"}, {"code": "search-type"}, {"code": "create"}],
                        "searchParam": [
                            {"name": "identifier", "type": "token"},
                            {"name": "name", "type": "string"},
                        ],
                    },
                    {
                        "type": "Practitioner",
                        "interaction": [{"code": "search-type"}],
                        "searchParam": [
                            {"name": "identifier", "type": "token"},
                            {"name": "name", "type": "string"},
                        ],
                    },
                    {
                        "type": "Appointment",
                        "interaction": [{"code": "search-type"}],
                        "searchParam": [
                            {"name": "status", "type": "token"},
                            {"name": "date", "type": "date"},
                        ],
                    },
                ],
            }
        ],
    }


@router.get("/metadata")
def capability_statement():
    return JSONResponse(content=_capability_statement(), media_type="application/fhir+json")
