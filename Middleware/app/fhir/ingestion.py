from __future__ import annotations

import copy
import hashlib
import json
import re
from contextlib import nullcontext
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any, Callable, Protocol
from zoneinfo import ZoneInfo

from app.db import conn
from app.fhir.normalizer import CPF_SYSTEM, CNS_SYSTEM, CRM_SYSTEM, SOURCE_TAG_SYSTEM


FHIR_JSON_CONTENT_TYPE = "application/fhir+json"
SUPPORTED_RESOURCE_TYPES = ("Patient", "Practitioner", "Location", "Appointment")
SUPPORTED_INGEST_TYPES = SUPPORTED_RESOURCE_TYPES + ("Bundle",)
CNES_SYSTEM = "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cnes"
MOTHERS_MAIDEN_URL = "http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName"
FORTALEZA_TZ = ZoneInfo("America/Fortaleza")
ACTIVE_APPOINTMENT_STATUSES = {
    "booked",
    "pending",
    "arrived",
    "checked-in",
    "fulfilled",
    "proposed",
    "waitlist",
}
_DIGITS_RE = re.compile(r"\D+")


class IngestionError(Exception):
    def __init__(self, detail: str, status_code: int = 422) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


@dataclass(frozen=True)
class IngestHeaders:
    source_system: str
    event_id: str
    idempotency_key: str
    api_key_id: str | None
    correlation_id: str | None = None
    content_type: str = FHIR_JSON_CONTENT_TYPE


@dataclass(frozen=True)
class StoredEvent:
    source_system: str
    event_id: str
    idempotency_key: str
    resource_type: str
    source_resource_id: str
    payload_sha256: str | None
    resource_store_id: str | None
    processing_status: str | None


@dataclass(frozen=True)
class NormalizedResource:
    source_system: str
    resource_type: str
    source_resource_id: str
    fhir_resource_id: str
    raw_resource: dict[str, Any]
    canonical_resource: dict[str, Any]
    canonical_identifiers: list[dict[str, str]]
    checksum_sha256: str
    resource_updated_at: datetime


@dataclass(frozen=True)
class IngestionResult:
    created: bool
    resource_type: str
    source_system: str
    source_resource_id: str
    event_id: str
    idempotency_key: str
    resource_store_id: str | None = None
    processed_resources: int = 1
    processed_resource_ids: tuple[str, ...] = ()

    def as_response(self) -> dict[str, Any]:
        payload = {
            "status": "created" if self.created else "replayed",
            "resourceType": self.resource_type,
            "source_system": self.source_system,
            "source_resource_id": self.source_resource_id,
            "event_id": self.event_id,
            "idempotency_key": self.idempotency_key,
        }
        if self.resource_store_id:
            payload["resource_store_id"] = self.resource_store_id
        if self.resource_type == "Bundle":
            payload["processed_resources"] = self.processed_resources
            payload["processed_resource_ids"] = list(self.processed_resource_ids)
        return payload


@dataclass(frozen=True)
class ShadowPersistResult:
    processed_resources: int
    created: int
    replayed: int
    failed: int


class FhirIngestionRepository(Protocol):
    def find_event_by_idempotency(self, *, source_system: str, idempotency_key: str) -> StoredEvent | None: ...

    def find_event_by_event_id(self, *, source_system: str, event_id: str) -> StoredEvent | None: ...

    def insert_ingestion_event(
        self,
        *,
        headers: IngestHeaders,
        resource_type: str,
        source_resource_id: str,
        payload_json: dict[str, Any],
        payload_sha256: str,
        event_type: str,
    ) -> None: ...

    def upsert_resource_store(self, *, headers: IngestHeaders, resource: NormalizedResource) -> str: ...

    def upsert_read_models(self, *, resource_store_id: str, resource: NormalizedResource) -> None: ...

    def mark_ingestion_event_projected(
        self,
        *,
        source_system: str,
        event_id: str,
        resource_store_id: str | None,
    ) -> None: ...


class PostgresFhirRepository:
    def __init__(self, connection) -> None:
        self.connection = connection

    def find_event_by_idempotency(self, *, source_system: str, idempotency_key: str) -> StoredEvent | None:
        row = self.connection.execute(
            """
            SELECT
              source_system,
              event_id,
              idempotency_key,
              resource_type,
              source_resource_id,
              payload_sha256,
              resource_store_id::text AS resource_store_id,
              processing_status
            FROM ingestion_events
            WHERE source_system = %s
              AND idempotency_key = %s
            """,
            (source_system, idempotency_key),
        ).fetchone()
        return _row_to_event(row)

    def find_event_by_event_id(self, *, source_system: str, event_id: str) -> StoredEvent | None:
        row = self.connection.execute(
            """
            SELECT
              source_system,
              event_id,
              idempotency_key,
              resource_type,
              source_resource_id,
              payload_sha256,
              resource_store_id::text AS resource_store_id,
              processing_status
            FROM ingestion_events
            WHERE source_system = %s
              AND event_id = %s
            """,
            (source_system, event_id),
        ).fetchone()
        return _row_to_event(row)

    def insert_ingestion_event(
        self,
        *,
        headers: IngestHeaders,
        resource_type: str,
        source_resource_id: str,
        payload_json: dict[str, Any],
        payload_sha256: str,
        event_type: str,
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO ingestion_events (
              source_system,
              event_id,
              idempotency_key,
              resource_type,
              source_resource_id,
              event_type,
              correlation_id,
              api_key_id,
              content_type,
              payload_json,
              payload_sha256,
              processing_status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s::uuid, %s, %s::jsonb, %s, 'accepted')
            """,
            (
                headers.source_system,
                headers.event_id,
                headers.idempotency_key,
                resource_type,
                source_resource_id,
                event_type,
                headers.correlation_id,
                headers.api_key_id,
                headers.content_type,
                json.dumps(payload_json),
                payload_sha256,
            ),
        )

    def upsert_resource_store(self, *, headers: IngestHeaders, resource: NormalizedResource) -> str:
        row = self.connection.execute(
            """
            INSERT INTO resource_store (
              source_system,
              resource_type,
              source_resource_id,
              fhir_resource_id,
              record_status,
              last_event_id,
              last_idempotency_key,
              canonical_identifiers,
              raw_resource,
              canonical_resource,
              checksum_sha256
            )
            VALUES (%s, %s, %s, %s, 'active', %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s)
            ON CONFLICT (source_system, resource_type, source_resource_id)
            DO UPDATE SET
              fhir_resource_id = EXCLUDED.fhir_resource_id,
              record_status = EXCLUDED.record_status,
              last_event_id = EXCLUDED.last_event_id,
              last_idempotency_key = EXCLUDED.last_idempotency_key,
              canonical_identifiers = EXCLUDED.canonical_identifiers,
              raw_resource = EXCLUDED.raw_resource,
              canonical_resource = EXCLUDED.canonical_resource,
              checksum_sha256 = EXCLUDED.checksum_sha256,
              last_seen_at = NOW()
            RETURNING id::text AS id
            """,
            (
                headers.source_system,
                resource.resource_type,
                resource.source_resource_id,
                resource.fhir_resource_id,
                headers.event_id,
                headers.idempotency_key,
                json.dumps(resource.canonical_identifiers),
                json.dumps(resource.raw_resource),
                json.dumps(resource.canonical_resource),
                resource.checksum_sha256,
            ),
        ).fetchone()
        return row["id"]

    def upsert_read_models(self, *, resource_store_id: str, resource: NormalizedResource) -> None:
        if resource.resource_type == "Patient":
            self._upsert_patient_projection(resource_store_id, resource)
            self._upsert_patient_identity(resource)
            return
        if resource.resource_type == "Practitioner":
            self._upsert_practitioner_projection(resource_store_id, resource)
            self._upsert_practitioner_identity(resource)
            return
        if resource.resource_type == "Location":
            self._upsert_location_projection(resource_store_id, resource)
            return
        if resource.resource_type == "Appointment":
            self._upsert_appointment_projection(resource_store_id, resource)
            return
        raise IngestionError(f"resourceType nao suportado para projecao: {resource.resource_type}.", 422)

    def mark_ingestion_event_projected(
        self,
        *,
        source_system: str,
        event_id: str,
        resource_store_id: str | None,
    ) -> None:
        self.connection.execute(
            """
            UPDATE ingestion_events
            SET
              resource_store_id = %s::uuid,
              processing_status = 'projected',
              processed_at = NOW()
            WHERE source_system = %s
              AND event_id = %s
            """,
            (resource_store_id, source_system, event_id),
        )

    def _upsert_patient_projection(self, resource_store_id: str, resource: NormalizedResource) -> None:
        payload = _patient_projection(resource)
        self.connection.execute(
            """
            INSERT INTO patient_projection (
              resource_store_id,
              source_system,
              source_resource_id,
              patient_id,
              record_status,
              full_name,
              cpf,
              cns,
              phone,
              email,
              birth_date,
              gender,
              address_text,
              city,
              mother_name,
              resource_updated_at
            )
            VALUES (%s::uuid, %s, %s, %s, 'active', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (resource_store_id)
            DO UPDATE SET
              source_system = EXCLUDED.source_system,
              source_resource_id = EXCLUDED.source_resource_id,
              patient_id = EXCLUDED.patient_id,
              record_status = EXCLUDED.record_status,
              full_name = EXCLUDED.full_name,
              cpf = EXCLUDED.cpf,
              cns = EXCLUDED.cns,
              phone = EXCLUDED.phone,
              email = EXCLUDED.email,
              birth_date = EXCLUDED.birth_date,
              gender = EXCLUDED.gender,
              address_text = EXCLUDED.address_text,
              city = EXCLUDED.city,
              mother_name = EXCLUDED.mother_name,
              resource_updated_at = EXCLUDED.resource_updated_at
            """,
            (
                resource_store_id,
                resource.source_system,
                resource.source_resource_id,
                resource.fhir_resource_id,
                payload["full_name"],
                payload["cpf"],
                payload["cns"],
                payload["phone"],
                payload["email"],
                payload["birth_date"],
                payload["gender"],
                payload["address_text"],
                payload["city"],
                payload["mother_name"],
                resource.resource_updated_at,
            ),
        )

    def _upsert_practitioner_projection(self, resource_store_id: str, resource: NormalizedResource) -> None:
        payload = _practitioner_projection(resource)
        self.connection.execute(
            """
            INSERT INTO practitioner_projection (
              resource_store_id,
              source_system,
              source_resource_id,
              practitioner_id,
              record_status,
              full_name,
              crm,
              specialty_text,
              phone,
              email,
              resource_updated_at
            )
            VALUES (%s::uuid, %s, %s, %s, 'active', %s, %s, %s, %s, %s, %s)
            ON CONFLICT (resource_store_id)
            DO UPDATE SET
              source_system = EXCLUDED.source_system,
              source_resource_id = EXCLUDED.source_resource_id,
              practitioner_id = EXCLUDED.practitioner_id,
              record_status = EXCLUDED.record_status,
              full_name = EXCLUDED.full_name,
              crm = EXCLUDED.crm,
              specialty_text = EXCLUDED.specialty_text,
              phone = EXCLUDED.phone,
              email = EXCLUDED.email,
              resource_updated_at = EXCLUDED.resource_updated_at
            """,
            (
                resource_store_id,
                resource.source_system,
                resource.source_resource_id,
                resource.fhir_resource_id,
                payload["full_name"],
                payload["crm"],
                payload["specialty_text"],
                payload["phone"],
                payload["email"],
                resource.resource_updated_at,
            ),
        )

    def _upsert_location_projection(self, resource_store_id: str, resource: NormalizedResource) -> None:
        payload = _location_projection(resource)
        self.connection.execute(
            """
            INSERT INTO location_projection (
              resource_store_id,
              source_system,
              source_resource_id,
              location_id,
              record_status,
              name,
              status,
              cnes,
              address_text,
              city,
              resource_updated_at
            )
            VALUES (%s::uuid, %s, %s, %s, 'active', %s, %s, %s, %s, %s, %s)
            ON CONFLICT (resource_store_id)
            DO UPDATE SET
              source_system = EXCLUDED.source_system,
              source_resource_id = EXCLUDED.source_resource_id,
              location_id = EXCLUDED.location_id,
              record_status = EXCLUDED.record_status,
              name = EXCLUDED.name,
              status = EXCLUDED.status,
              cnes = EXCLUDED.cnes,
              address_text = EXCLUDED.address_text,
              city = EXCLUDED.city,
              resource_updated_at = EXCLUDED.resource_updated_at
            """,
            (
                resource_store_id,
                resource.source_system,
                resource.source_resource_id,
                resource.fhir_resource_id,
                payload["name"],
                payload["status"],
                payload["cnes"],
                payload["address_text"],
                payload["city"],
                resource.resource_updated_at,
            ),
        )

    def _upsert_appointment_projection(self, resource_store_id: str, resource: NormalizedResource) -> None:
        payload = _appointment_projection(resource)
        self.connection.execute(
            """
            INSERT INTO appointment_projection (
              resource_store_id,
              source_system,
              source_resource_id,
              appointment_id,
              record_status,
              status,
              start_at,
              end_at,
              modality,
              specialty_code,
              specialty_text,
              description,
              comment,
              patient_ref,
              patient_source_resource_id,
              patient_display,
              practitioner_ref,
              practitioner_source_resource_id,
              practitioner_display,
              location_ref,
              location_source_resource_id,
              location_display,
              resource_updated_at
            )
            VALUES (
              %s::uuid, %s, %s, %s, 'active', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (resource_store_id)
            DO UPDATE SET
              source_system = EXCLUDED.source_system,
              source_resource_id = EXCLUDED.source_resource_id,
              appointment_id = EXCLUDED.appointment_id,
              record_status = EXCLUDED.record_status,
              status = EXCLUDED.status,
              start_at = EXCLUDED.start_at,
              end_at = EXCLUDED.end_at,
              modality = EXCLUDED.modality,
              specialty_code = EXCLUDED.specialty_code,
              specialty_text = EXCLUDED.specialty_text,
              description = EXCLUDED.description,
              comment = EXCLUDED.comment,
              patient_ref = EXCLUDED.patient_ref,
              patient_source_resource_id = EXCLUDED.patient_source_resource_id,
              patient_display = EXCLUDED.patient_display,
              practitioner_ref = EXCLUDED.practitioner_ref,
              practitioner_source_resource_id = EXCLUDED.practitioner_source_resource_id,
              practitioner_display = EXCLUDED.practitioner_display,
              location_ref = EXCLUDED.location_ref,
              location_source_resource_id = EXCLUDED.location_source_resource_id,
              location_display = EXCLUDED.location_display,
              resource_updated_at = EXCLUDED.resource_updated_at
            """,
            (
                resource_store_id,
                resource.source_system,
                resource.source_resource_id,
                resource.fhir_resource_id,
                payload["status"],
                payload["start_at"],
                payload["end_at"],
                payload["modality"],
                payload["specialty_code"],
                payload["specialty_text"],
                payload["description"],
                payload["comment"],
                payload["patient_ref"],
                payload["patient_source_resource_id"],
                payload["patient_display"],
                payload["practitioner_ref"],
                payload["practitioner_source_resource_id"],
                payload["practitioner_display"],
                payload["location_ref"],
                payload["location_source_resource_id"],
                payload["location_display"],
                resource.resource_updated_at,
            ),
        )

    def _upsert_patient_identity(self, resource: NormalizedResource) -> None:
        payload = _patient_projection(resource)
        cns = payload["cns"]
        cpf = payload["cpf"]
        if not (cns or cpf):
            return

        row = None
        if cns:
            row = self.connection.execute(
                "SELECT id::text AS id FROM patient_identity_projection WHERE cns = %s",
                (cns,),
            ).fetchone()
        if row is None and cpf:
            row = self.connection.execute(
                "SELECT id::text AS id FROM patient_identity_projection WHERE cpf = %s",
                (cpf,),
            ).fetchone()

        sistema_col = "sistema_a_source_resource_id" if resource.source_system == "sistema_a" else "sistema_b_source_resource_id"
        visto_col = "ultima_visto_a" if resource.source_system == "sistema_a" else "ultima_visto_b"

        if row:
            self.connection.execute(
                f"""
                UPDATE patient_identity_projection
                SET {sistema_col} = %s,
                    {visto_col} = %s,
                    preferred_name = COALESCE(%s, preferred_name),
                    cns = COALESCE(%s, cns),
                    cpf = COALESCE(%s, cpf)
                WHERE id = %s::uuid
                """,
                (
                    resource.source_resource_id,
                    resource.resource_updated_at,
                    payload["full_name"],
                    cns,
                    cpf,
                    row["id"],
                ),
            )
            return

        self.connection.execute(
            f"""
            INSERT INTO patient_identity_projection
              (cns, cpf, preferred_name, {sistema_col}, {visto_col})
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                cns,
                cpf,
                payload["full_name"],
                resource.source_resource_id,
                resource.resource_updated_at,
            ),
        )

    def _upsert_practitioner_identity(self, resource: NormalizedResource) -> None:
        payload = _practitioner_projection(resource)
        crm = payload["crm"]
        if not crm:
            return

        sistema_col = "sistema_a_source_resource_id" if resource.source_system == "sistema_a" else "sistema_b_source_resource_id"
        visto_col = "ultima_visto_a" if resource.source_system == "sistema_a" else "ultima_visto_b"
        row = self.connection.execute(
            "SELECT id::text AS id FROM practitioner_identity_projection WHERE crm = %s",
            (crm,),
        ).fetchone()

        if row:
            self.connection.execute(
                f"""
                UPDATE practitioner_identity_projection
                SET {sistema_col} = %s,
                    {visto_col} = %s,
                    preferred_name = COALESCE(%s, preferred_name)
                WHERE id = %s::uuid
                """,
                (
                    resource.source_resource_id,
                    resource.resource_updated_at,
                    payload["full_name"],
                    row["id"],
                ),
            )
            return

        self.connection.execute(
            f"""
            INSERT INTO practitioner_identity_projection
              (crm, preferred_name, {sistema_col}, {visto_col})
            VALUES (%s, %s, %s, %s)
            """,
            (
                crm,
                payload["full_name"],
                resource.source_resource_id,
                resource.resource_updated_at,
            ),
        )


def ingest_fhir_resource(
    *,
    headers: IngestHeaders,
    payload: dict[str, Any],
    expected_resource_type: str,
    repository: FhirIngestionRepository,
    event_type: str = "upsert",
) -> IngestionResult:
    normalized = normalize_resource(
        payload=payload,
        expected_resource_type=expected_resource_type,
        source_system=headers.source_system,
    )
    return _ingest_normalized_resource(
        headers=headers,
        payload=payload,
        normalized=normalized,
        repository=repository,
        event_type=event_type,
    )


def persist_shadow_entries(
    entries: list[dict[str, Any]],
    *,
    source_system: str,
    repository_factory: Callable[[Any], FhirIngestionRepository] = PostgresFhirRepository,
    connection_factory=conn,
) -> ShadowPersistResult:
    supported_entries = [
        entry for entry in entries
        if isinstance(entry, dict)
        and isinstance(entry.get("resource"), dict)
        and (entry["resource"].get("resourceType") in SUPPORTED_RESOURCE_TYPES)
    ]
    if not supported_entries:
        return ShadowPersistResult(processed_resources=0, created=0, replayed=0, failed=0)

    created = replayed = failed = 0
    with connection_factory() as connection:
        repository = repository_factory(connection)
        for entry in supported_entries:
            resource = entry["resource"]
            resource_type = str(resource.get("resourceType"))
            try:
                normalized = normalize_resource(
                    payload=resource,
                    expected_resource_type=resource_type,
                    source_system=source_system,
                )
                headers = _shadow_headers_for_resource(normalized)
                tx = connection.transaction() if hasattr(connection, "transaction") else nullcontext()
                with tx:
                    result = _ingest_normalized_resource(
                        headers=headers,
                        payload=resource,
                        normalized=normalized,
                        repository=repository,
                        event_type="backfill",
                    )
                if result.created:
                    created += 1
                else:
                    replayed += 1
            except Exception:
                failed += 1

    return ShadowPersistResult(
        processed_resources=len(supported_entries),
        created=created,
        replayed=replayed,
        failed=failed,
    )


def _ingest_normalized_resource(
    *,
    headers: IngestHeaders,
    payload: dict[str, Any],
    normalized: NormalizedResource,
    repository: FhirIngestionRepository,
    event_type: str,
) -> IngestionResult:
    payload_sha256 = _sha256_json(payload)

    existing = _resolve_existing_event(
        repository=repository,
        headers=headers,
        resource_type=normalized.resource_type,
        source_resource_id=normalized.source_resource_id,
        payload_sha256=payload_sha256,
    )
    if existing:
        return IngestionResult(
            created=False,
            resource_type=normalized.resource_type,
            source_system=headers.source_system,
            source_resource_id=normalized.source_resource_id,
            event_id=headers.event_id,
            idempotency_key=headers.idempotency_key,
            resource_store_id=existing.resource_store_id,
        )

    repository.insert_ingestion_event(
        headers=headers,
        resource_type=normalized.resource_type,
        source_resource_id=normalized.source_resource_id,
        payload_json=payload,
        payload_sha256=payload_sha256,
        event_type=event_type,
    )
    resource_store_id = repository.upsert_resource_store(headers=headers, resource=normalized)
    repository.upsert_read_models(resource_store_id=resource_store_id, resource=normalized)
    repository.mark_ingestion_event_projected(
        source_system=headers.source_system,
        event_id=headers.event_id,
        resource_store_id=resource_store_id,
    )
    return IngestionResult(
        created=True,
        resource_type=normalized.resource_type,
        source_system=headers.source_system,
        source_resource_id=normalized.source_resource_id,
        event_id=headers.event_id,
        idempotency_key=headers.idempotency_key,
        resource_store_id=resource_store_id,
    )


def ingest_fhir_bundle(
    *,
    headers: IngestHeaders,
    payload: dict[str, Any],
    repository: FhirIngestionRepository,
) -> IngestionResult:
    if not isinstance(payload, dict) or payload.get("resourceType") != "Bundle":
        raise IngestionError("Body deve ser um recurso FHIR Bundle.", 422)

    entries = payload.get("entry")
    if not isinstance(entries, list) or not entries:
        raise IngestionError("Bundle deve conter entry[].", 422)

    normalized_resources: list[NormalizedResource] = []
    processed_ids: list[str] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict) or not isinstance(entry.get("resource"), dict):
            raise IngestionError(f"Bundle.entry[{index}] precisa conter resource.", 422)
        resource = entry["resource"]
        resource_type = resource.get("resourceType")
        if resource_type not in SUPPORTED_RESOURCE_TYPES:
            raise IngestionError(
                f"Bundle.entry[{index}] possui resourceType nao suportado: {resource_type}.",
                422,
            )
        normalized = normalize_resource(
            payload=resource,
            expected_resource_type=str(resource_type),
            source_system=headers.source_system,
        )
        normalized_resources.append(normalized)
        processed_ids.append(f"{normalized.resource_type}/{normalized.source_resource_id}")

    source_resource_id = bundle_source_resource_id(payload, headers)
    payload_sha256 = _sha256_json(payload)

    existing = _resolve_existing_event(
        repository=repository,
        headers=headers,
        resource_type="Bundle",
        source_resource_id=source_resource_id,
        payload_sha256=payload_sha256,
    )
    if existing:
        return IngestionResult(
            created=False,
            resource_type="Bundle",
            source_system=headers.source_system,
            source_resource_id=source_resource_id,
            event_id=headers.event_id,
            idempotency_key=headers.idempotency_key,
            processed_resources=len(normalized_resources),
            processed_resource_ids=tuple(processed_ids),
        )

    repository.insert_ingestion_event(
        headers=headers,
        resource_type="Bundle",
        source_resource_id=source_resource_id,
        payload_json=payload,
        payload_sha256=payload_sha256,
        event_type="bundle-import",
    )

    for normalized in normalized_resources:
        resource_store_id = repository.upsert_resource_store(headers=headers, resource=normalized)
        repository.upsert_read_models(resource_store_id=resource_store_id, resource=normalized)

    repository.mark_ingestion_event_projected(
        source_system=headers.source_system,
        event_id=headers.event_id,
        resource_store_id=None,
    )
    return IngestionResult(
        created=True,
        resource_type="Bundle",
        source_system=headers.source_system,
        source_resource_id=source_resource_id,
        event_id=headers.event_id,
        idempotency_key=headers.idempotency_key,
        processed_resources=len(normalized_resources),
        processed_resource_ids=tuple(processed_ids),
    )


def normalize_resource(
    *,
    payload: dict[str, Any],
    expected_resource_type: str,
    source_system: str,
) -> NormalizedResource:
    if expected_resource_type not in SUPPORTED_RESOURCE_TYPES:
        raise IngestionError(f"resourceType nao suportado: {expected_resource_type}.", 422)
    if not isinstance(payload, dict):
        raise IngestionError("Body precisa ser um JSON object FHIR.", 422)
    if payload.get("resourceType") != expected_resource_type:
        raise IngestionError(
            f"resourceType do body deve ser {expected_resource_type}.",
            422,
        )

    raw_resource = copy.deepcopy(payload)
    canonical_resource = copy.deepcopy(payload)
    canonical_resource["id"] = _require_id(canonical_resource)
    _tag_source_system(canonical_resource, source_system)

    if expected_resource_type == "Patient":
        _normalize_patient(canonical_resource)
    elif expected_resource_type == "Practitioner":
        _normalize_practitioner(canonical_resource)
    elif expected_resource_type == "Location":
        _normalize_location(canonical_resource)
    elif expected_resource_type == "Appointment":
        _normalize_appointment(canonical_resource)

    resource_updated_at = _resource_updated_at(canonical_resource)
    return NormalizedResource(
        source_system=source_system,
        resource_type=expected_resource_type,
        source_resource_id=canonical_resource["id"],
        fhir_resource_id=canonical_resource["id"],
        raw_resource=raw_resource,
        canonical_resource=canonical_resource,
        canonical_identifiers=_canonical_identifiers(canonical_resource),
        checksum_sha256=_sha256_json(canonical_resource),
        resource_updated_at=resource_updated_at,
    )


def bundle_source_resource_id(bundle: dict[str, Any], headers: IngestHeaders) -> str:
    bundle_id = str(bundle.get("id") or "").strip()
    if bundle_id:
        return bundle_id
    return f"bundle:{headers.event_id}"


def _shadow_headers_for_resource(resource: NormalizedResource) -> IngestHeaders:
    stable_key = (
        f"shadow:{resource.source_system}:{resource.resource_type}:"
        f"{resource.source_resource_id}:{resource.checksum_sha256}"
    )
    return IngestHeaders(
        source_system=resource.source_system,
        event_id=stable_key,
        idempotency_key=stable_key,
        api_key_id=None,
        correlation_id="shadow-read",
        content_type=FHIR_JSON_CONTENT_TYPE,
    )


def _resolve_existing_event(
    *,
    repository: FhirIngestionRepository,
    headers: IngestHeaders,
    resource_type: str,
    source_resource_id: str,
    payload_sha256: str,
) -> StoredEvent | None:
    existing = repository.find_event_by_idempotency(
        source_system=headers.source_system,
        idempotency_key=headers.idempotency_key,
    )
    if existing:
        if _same_event(existing, headers, resource_type, source_resource_id, payload_sha256):
            return existing
        raise IngestionError("Idempotency-Key ja foi usado por outro evento.", 409)

    existing = repository.find_event_by_event_id(
        source_system=headers.source_system,
        event_id=headers.event_id,
    )
    if existing:
        if _same_event(existing, headers, resource_type, source_resource_id, payload_sha256):
            return existing
        raise IngestionError("X-Event-Id ja foi usado por outro evento.", 409)
    return None


def _same_event(
    existing: StoredEvent,
    headers: IngestHeaders,
    resource_type: str,
    source_resource_id: str,
    payload_sha256: str,
) -> bool:
    return (
        existing.source_system == headers.source_system
        and existing.event_id == headers.event_id
        and existing.idempotency_key == headers.idempotency_key
        and existing.resource_type == resource_type
        and existing.source_resource_id == source_resource_id
        and (existing.payload_sha256 or "") == payload_sha256
    )


def _normalize_patient(resource: dict[str, Any]) -> None:
    name = _first_name(resource)
    name["text"] = _human_name_text(name)

    identifiers = resource.get("identifier")
    if not isinstance(identifiers, list):
        raise IngestionError("Patient.identifier precisa ser uma lista.", 422)

    found_official = False
    for ident in identifiers:
        if not isinstance(ident, dict):
            continue
        system = (ident.get("system") or "").rstrip("/")
        value = str(ident.get("value") or "").strip()
        if system == CPF_SYSTEM:
            value = _digits_only(value)
        elif system == CNS_SYSTEM:
            value = _digits_only(value)
        else:
            value = value.strip()
        if value:
            ident["value"] = value
        use = (ident.get("use") or "").strip().lower()
        if system in {CPF_SYSTEM, CNS_SYSTEM} and value and use in {"", "official"}:
            found_official = True

    if not found_official:
        raise IngestionError("Patient precisa de identifier oficial com CPF ou CNS.", 422)

    gender = resource.get("gender")
    if gender is not None:
        resource["gender"] = _normalize_gender(gender)

    birth_date = resource.get("birthDate")
    if birth_date:
        _parse_date(str(birth_date), field_name="Patient.birthDate")


def _normalize_practitioner(resource: dict[str, Any]) -> None:
    name = _first_name(resource)
    name["text"] = _human_name_text(name)

    identifiers = resource.get("identifier")
    if not isinstance(identifiers, list):
        raise IngestionError("Practitioner.identifier precisa ser uma lista.", 422)

    found_crm = False
    for ident in identifiers:
        if not isinstance(ident, dict):
            continue
        system = (ident.get("system") or "").rstrip("/")
        value = str(ident.get("value") or "").strip()
        if system == CRM_SYSTEM:
            value = _normalize_crm(value)
            if value:
                ident["value"] = value
        if system == CRM_SYSTEM and value and (ident.get("use") or "").strip().lower() in {"", "official"}:
            found_crm = True

    if not found_crm:
        raise IngestionError("Practitioner precisa de identifier oficial de CRM.", 422)


def _normalize_location(resource: dict[str, Any]) -> None:
    name = str(resource.get("name") or "").strip()
    if not name:
        raise IngestionError("Location.name e obrigatorio.", 422)
    resource["name"] = name

    identifiers = resource.get("identifier") or []
    for ident in identifiers:
        if not isinstance(ident, dict):
            continue
        system = (ident.get("system") or "").rstrip("/")
        value = str(ident.get("value") or "").strip()
        if system == CNES_SYSTEM:
            ident["value"] = _digits_only(value)

    if "status" in resource:
        resource["status"] = _normalize_location_status(resource.get("status"))


def _normalize_appointment(resource: dict[str, Any]) -> None:
    status = _normalize_appointment_status(resource.get("status"))
    resource["status"] = status

    patient = practitioner = location = None
    for participant in resource.get("participant") or []:
        if not isinstance(participant, dict):
            continue
        actor = participant.get("actor") or {}
        if not isinstance(actor, dict):
            continue
        reference = str(actor.get("reference") or "").strip()
        resource_type, _ = _split_reference(reference)
        if resource_type == "Patient" and patient is None:
            patient = reference
        elif resource_type == "Practitioner" and practitioner is None:
            practitioner = reference
        elif resource_type == "Location" and location is None:
            location = reference

    if not (patient and practitioner and location):
        raise IngestionError(
            "Appointment.participant precisa referenciar Patient, Practitioner e Location.",
            422,
        )

    if status in ACTIVE_APPOINTMENT_STATUSES:
        start = resource.get("start")
        end = resource.get("end")
        if not start or not end:
            raise IngestionError("Appointment ativo precisa de start e end.", 422)
        resource["start"] = _normalize_datetime(str(start), field_name="Appointment.start")
        resource["end"] = _normalize_datetime(str(end), field_name="Appointment.end")
    else:
        if resource.get("start"):
            resource["start"] = _normalize_datetime(str(resource["start"]), field_name="Appointment.start")
        if resource.get("end"):
            resource["end"] = _normalize_datetime(str(resource["end"]), field_name="Appointment.end")


def _first_name(resource: dict[str, Any]) -> dict[str, Any]:
    names = resource.get("name")
    if not isinstance(names, list) or not names:
        raise IngestionError(f"{resource.get('resourceType')}.name[0] e obrigatorio.", 422)
    if not isinstance(names[0], dict):
        raise IngestionError(f"{resource.get('resourceType')}.name[0] precisa ser object.", 422)
    return names[0]


def _human_name_text(name: dict[str, Any]) -> str:
    text = str(name.get("text") or "").strip()
    if text:
        return text
    given = [str(part).strip() for part in name.get("given") or [] if str(part).strip()]
    family = str(name.get("family") or "").strip()
    text = " ".join(given + ([family] if family else [])).strip()
    if not text:
        raise IngestionError("Nome textual do recurso e obrigatorio.", 422)
    return text


def _require_id(resource: dict[str, Any]) -> str:
    rid = str(resource.get("id") or "").strip()
    if not rid:
        raise IngestionError(f"{resource.get('resourceType')}.id e obrigatorio.", 422)
    return rid


def _tag_source_system(resource: dict[str, Any], source_system: str) -> None:
    meta = resource.setdefault("meta", {})
    tags = meta.setdefault("tag", [])
    for tag in tags:
        if tag.get("system") == SOURCE_TAG_SYSTEM and tag.get("code") == source_system:
            return
    tags.append(
        {
            "system": SOURCE_TAG_SYSTEM,
            "code": source_system,
            "display": f"Origem: {source_system}",
        }
    )


def _normalize_gender(value: Any) -> str:
    raw = str(value or "").strip().lower()
    mapping = {
        "m": "male",
        "male": "male",
        "masculino": "male",
        "f": "female",
        "female": "female",
        "feminino": "female",
        "o": "other",
        "other": "other",
        "outro": "other",
        "nao informado": "unknown",
        "não informado": "unknown",
        "desconhecido": "unknown",
        "unknown": "unknown",
    }
    return mapping.get(raw, raw or "unknown")


def _normalize_location_status(value: Any) -> str:
    if isinstance(value, bool):
        return "active" if value else "inactive"
    raw = str(value or "").strip().lower()
    mapping = {
        "ativo": "active",
        "active": "active",
        "inativo": "inactive",
        "inactive": "inactive",
        "suspenso": "suspended",
        "suspended": "suspended",
    }
    return mapping.get(raw, raw)


def _normalize_appointment_status(value: Any) -> str:
    raw = str(value or "").strip().lower()
    mapping = {
        "agendado": "booked",
        "booked": "booked",
        "confirmado": "booked",
        "cancelado": "cancelled",
        "cancelled": "cancelled",
        "atendido": "fulfilled",
        "realizado": "fulfilled",
        "fulfilled": "fulfilled",
        "faltou": "noshow",
        "no-show": "noshow",
        "noshow": "noshow",
        "pendente": "pending",
        "pending": "pending",
        "chegou": "arrived",
        "arrived": "arrived",
        "check-in": "checked-in",
        "checked-in": "checked-in",
        "checkedin": "checked-in",
        "proposto": "proposed",
        "proposed": "proposed",
        "fila": "waitlist",
        "waitlist": "waitlist",
    }
    normalized = mapping.get(raw, raw)
    if not normalized:
        raise IngestionError("Appointment.status e obrigatorio.", 422)
    return normalized


def _normalize_datetime(value: str, *, field_name: str) -> str:
    if "T" not in value:
        raise IngestionError(f"{field_name} deve ser um datetime ISO 8601.", 422)
    text = value.replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError as exc:
        raise IngestionError(f"{field_name} invalido: {value}.", 422) from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=FORTALEZA_TZ)
    return dt.isoformat()


def _parse_date(value: str, *, field_name: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise IngestionError(f"{field_name} invalido: {value}.", 422) from exc


def _split_reference(reference: str) -> tuple[str | None, str | None]:
    ref = str(reference or "").strip()
    if not ref or "/" not in ref:
        return None, None
    resource_type, resource_id = ref.split("/", 1)
    if resource_type not in {"Patient", "Practitioner", "Location"}:
        return None, None
    return resource_type, resource_id or None


def _resource_updated_at(resource: dict[str, Any]) -> datetime:
    last_updated = ((resource.get("meta") or {}).get("lastUpdated") or "").strip()
    if not last_updated:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(last_updated.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=FORTALEZA_TZ)
    return parsed


def _canonical_identifiers(resource: dict[str, Any]) -> list[dict[str, str]]:
    identifiers: list[dict[str, str]] = []
    for ident in resource.get("identifier") or []:
        if not isinstance(ident, dict):
            continue
        system = str(ident.get("system") or "").rstrip("/")
        value = str(ident.get("value") or "").strip()
        if not (system and value):
            continue
        identifiers.append(
            {
                "system": system,
                "value": value,
                "use": str(ident.get("use") or "").strip(),
            }
        )
    return identifiers


def _patient_projection(resource: NormalizedResource) -> dict[str, Any]:
    patient = resource.canonical_resource
    telecom = _telecom_map(patient)
    address = (patient.get("address") or [{}])[0] if isinstance(patient.get("address"), list) and patient.get("address") else {}
    return {
        "full_name": _human_name_text(_first_name(patient)),
        "cpf": _identifier_by_system(patient, CPF_SYSTEM),
        "cns": _identifier_by_system(patient, CNS_SYSTEM),
        "phone": telecom.get("phone"),
        "email": telecom.get("email"),
        "birth_date": _birth_date_or_none(patient.get("birthDate")),
        "gender": patient.get("gender"),
        "address_text": _address_text(address),
        "city": str(address.get("city") or "").strip() or None,
        "mother_name": _mother_name(patient),
    }


def _practitioner_projection(resource: NormalizedResource) -> dict[str, Any]:
    practitioner = resource.canonical_resource
    telecom = _telecom_map(practitioner)
    qualification = (practitioner.get("qualification") or [{}])[0] if practitioner.get("qualification") else {}
    code = qualification.get("code") or {}
    specialty_text = str(code.get("text") or "").strip()
    if not specialty_text:
        specialty_text = str(((code.get("coding") or [{}])[0].get("display") if isinstance(code.get("coding"), list) else "") or "").strip()
    return {
        "full_name": _human_name_text(_first_name(practitioner)),
        "crm": _identifier_by_system(practitioner, CRM_SYSTEM),
        "specialty_text": specialty_text or None,
        "phone": telecom.get("phone"),
        "email": telecom.get("email"),
    }


def _location_projection(resource: NormalizedResource) -> dict[str, Any]:
    location = resource.canonical_resource
    address = (location.get("address") or [{}])[0] if isinstance(location.get("address"), list) and location.get("address") else {}
    return {
        "name": str(location.get("name") or "").strip(),
        "status": str(location.get("status") or "").strip() or None,
        "cnes": _identifier_by_system(location, CNES_SYSTEM),
        "address_text": _address_text(address),
        "city": str(address.get("city") or "").strip() or None,
    }


def _appointment_projection(resource: NormalizedResource) -> dict[str, Any]:
    appointment = resource.canonical_resource
    appointment_type = appointment.get("appointmentType") or {}
    service_type = (appointment.get("serviceType") or [{}])[0] if appointment.get("serviceType") else {}
    service_coding = (service_type.get("coding") or [{}])[0] if isinstance(service_type.get("coding"), list) and service_type.get("coding") else {}
    participants = {
        "Patient": {"ref": None, "id": None, "display": None},
        "Practitioner": {"ref": None, "id": None, "display": None},
        "Location": {"ref": None, "id": None, "display": None},
    }
    for participant in appointment.get("participant") or []:
        actor = participant.get("actor") or {}
        reference = str(actor.get("reference") or "").strip()
        display = str(actor.get("display") or "").strip() or None
        resource_type, source_id = _split_reference(reference)
        if resource_type and participants[resource_type]["ref"] is None:
            participants[resource_type] = {
                "ref": reference,
                "id": source_id,
                "display": display,
            }
    return {
        "status": appointment.get("status"),
        "start_at": _datetime_or_none(appointment.get("start")),
        "end_at": _datetime_or_none(appointment.get("end")),
        "modality": str(appointment_type.get("text") or "").strip() or None,
        "specialty_code": str(service_coding.get("code") or "").strip() or None,
        "specialty_text": str(service_type.get("text") or service_coding.get("display") or "").strip() or None,
        "description": str(appointment.get("description") or "").strip() or None,
        "comment": str(appointment.get("comment") or "").strip() or None,
        "patient_ref": participants["Patient"]["ref"],
        "patient_source_resource_id": participants["Patient"]["id"],
        "patient_display": participants["Patient"]["display"],
        "practitioner_ref": participants["Practitioner"]["ref"],
        "practitioner_source_resource_id": participants["Practitioner"]["id"],
        "practitioner_display": participants["Practitioner"]["display"],
        "location_ref": participants["Location"]["ref"],
        "location_source_resource_id": participants["Location"]["id"],
        "location_display": participants["Location"]["display"],
    }


def _identifier_by_system(resource: dict[str, Any], system: str) -> str | None:
    for ident in resource.get("identifier") or []:
        if not isinstance(ident, dict):
            continue
        if str(ident.get("system") or "").rstrip("/") == system.rstrip("/"):
            value = str(ident.get("value") or "").strip()
            if value:
                return value
    return None


def _telecom_map(resource: dict[str, Any]) -> dict[str, str]:
    telecom: dict[str, str] = {}
    for item in resource.get("telecom") or []:
        if not isinstance(item, dict):
            continue
        system = str(item.get("system") or "").strip()
        value = str(item.get("value") or "").strip()
        if system and value and system not in telecom:
            telecom[system] = value
    return telecom


def _address_text(address: dict[str, Any]) -> str | None:
    text = str(address.get("text") or "").strip()
    if text:
        return text
    lines = [str(line).strip() for line in address.get("line") or [] if str(line).strip()]
    if lines:
        return ", ".join(lines)
    return None


def _mother_name(resource: dict[str, Any]) -> str | None:
    for ext in resource.get("extension") or []:
        if not isinstance(ext, dict):
            continue
        if ext.get("url") != MOTHERS_MAIDEN_URL:
            continue
        value = str(ext.get("valueString") or "").strip()
        if value:
            return value
    return None


def _birth_date_or_none(value: Any) -> date | None:
    text = str(value or "").strip()
    if not text:
        return None
    return _parse_date(text, field_name="Patient.birthDate")


def _datetime_or_none(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    return datetime.fromisoformat(_normalize_datetime(text, field_name="datetime"))


def _digits_only(value: str) -> str:
    return _DIGITS_RE.sub("", str(value or ""))


def _normalize_crm(value: str) -> str:
    raw = str(value or "").upper()
    digits = _digits_only(raw)
    letters = "".join(ch for ch in raw if ch.isalpha())
    uf = letters[-2:] if len(letters) >= 2 else letters
    normalized = f"{uf}{digits}" if uf else digits
    return normalized.strip()


def _sha256_json(payload: dict[str, Any]) -> str:
    return hashlib.sha256(_stable_json(payload).encode("utf-8")).hexdigest()


def _stable_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _row_to_event(row: dict[str, Any] | None) -> StoredEvent | None:
    if not row:
        return None
    return StoredEvent(
        source_system=row["source_system"],
        event_id=row["event_id"],
        idempotency_key=row["idempotency_key"],
        resource_type=row["resource_type"],
        source_resource_id=row["source_resource_id"],
        payload_sha256=row["payload_sha256"],
        resource_store_id=row["resource_store_id"],
        processing_status=row["processing_status"],
    )
