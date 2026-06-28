from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, Response, status

from app.auth import require_api_key
from app.db import conn
from app.fhir.ingestion import (
    FHIR_JSON_CONTENT_TYPE,
    IngestHeaders,
    IngestionError,
    PostgresFhirRepository,
    ingest_fhir_bundle,
    ingest_fhir_resource,
)


router = APIRouter(
    tags=["FHIR Ingest"],
    dependencies=[Depends(require_api_key())],
)


def _ingest_headers(
    request: Request,
    x_source_system: str = Header(..., alias="X-Source-System"),
    x_event_id: str = Header(..., alias="X-Event-Id"),
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    x_correlation_id: str | None = Header(default=None, alias="X-Correlation-Id"),
) -> IngestHeaders:
    content_type = (request.headers.get("content-type") or "").split(";", 1)[0].strip().lower()
    if content_type != FHIR_JSON_CONTENT_TYPE:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Content-Type deve ser {FHIR_JSON_CONTENT_TYPE}.",
        )
    if not x_source_system.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="X-Source-System e obrigatorio.")
    if not x_event_id.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="X-Event-Id e obrigatorio.")
    if not idempotency_key.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Idempotency-Key e obrigatorio.")

    return IngestHeaders(
        source_system=x_source_system,
        event_id=x_event_id.strip(),
        idempotency_key=idempotency_key.strip(),
        api_key_id=getattr(request.state, "api_key_id", None),
        correlation_id=(x_correlation_id or "").strip() or None,
        content_type=FHIR_JSON_CONTENT_TYPE,
    )


def _run_resource_ingest(
    *,
    payload: dict,
    expected_resource_type: str,
    headers: IngestHeaders,
    response: Response,
):
    try:
        with conn() as connection:
            repository = PostgresFhirRepository(connection)
            result = ingest_fhir_resource(
                headers=headers,
                payload=payload,
                expected_resource_type=expected_resource_type,
                repository=repository,
            )
    except IngestionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    response.status_code = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
    return result.as_response()


def _run_bundle_ingest(
    *,
    payload: dict,
    headers: IngestHeaders,
    response: Response,
):
    try:
        with conn() as connection:
            repository = PostgresFhirRepository(connection)
            result = ingest_fhir_bundle(
                headers=headers,
                payload=payload,
                repository=repository,
            )
    except IngestionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    response.status_code = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
    return result.as_response()


@router.post("/fhir/Patient")
def post_fhir_patient(
    response: Response,
    payload: dict = Body(...),
    headers: IngestHeaders = Depends(_ingest_headers),
):
    return _run_resource_ingest(
        payload=payload,
        expected_resource_type="Patient",
        headers=headers,
        response=response,
    )


@router.post("/fhir/Practitioner")
def post_fhir_practitioner(
    response: Response,
    payload: dict = Body(...),
    headers: IngestHeaders = Depends(_ingest_headers),
):
    return _run_resource_ingest(
        payload=payload,
        expected_resource_type="Practitioner",
        headers=headers,
        response=response,
    )


@router.post("/fhir/Location")
def post_fhir_location(
    response: Response,
    payload: dict = Body(...),
    headers: IngestHeaders = Depends(_ingest_headers),
):
    return _run_resource_ingest(
        payload=payload,
        expected_resource_type="Location",
        headers=headers,
        response=response,
    )


@router.post("/fhir/Appointment")
def post_fhir_appointment(
    response: Response,
    payload: dict = Body(...),
    headers: IngestHeaders = Depends(_ingest_headers),
):
    return _run_resource_ingest(
        payload=payload,
        expected_resource_type="Appointment",
        headers=headers,
        response=response,
    )


@router.post("/fhir/Bundle")
def post_fhir_bundle(
    response: Response,
    payload: dict = Body(...),
    headers: IngestHeaders = Depends(_ingest_headers),
):
    return _run_bundle_ingest(
        payload=payload,
        headers=headers,
        response=response,
    )
