from contextlib import contextmanager
from dataclasses import replace
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

import app.auth as auth_module
import app.main as main_module
import app.rotas.fhir_escrita as fhir_escrita_module
from app.fhir.ingestion import (
    CPF_SYSTEM,
    CRM_SYSTEM,
    IngestHeaders,
    IngestionResult,
    StoredEvent,
    ingest_fhir_bundle,
    ingest_fhir_resource,
)


class FakeRepository:
    def __init__(self):
        self.events_by_idempotency: dict[tuple[str, str], StoredEvent] = {}
        self.events_by_event_id: dict[tuple[str, str], StoredEvent] = {}
        self.resource_store: dict[tuple[str, str, str], dict] = {}
        self.read_models: dict[tuple[str, str], dict] = {}

    def find_event_by_idempotency(self, *, source_system: str, idempotency_key: str) -> StoredEvent | None:
        return self.events_by_idempotency.get((source_system, idempotency_key))

    def find_event_by_event_id(self, *, source_system: str, event_id: str) -> StoredEvent | None:
        return self.events_by_event_id.get((source_system, event_id))

    def insert_ingestion_event(
        self,
        *,
        headers: IngestHeaders,
        resource_type: str,
        source_resource_id: str,
        payload_json: dict,
        payload_sha256: str,
        event_type: str,
    ) -> None:
        event = StoredEvent(
            source_system=headers.source_system,
            event_id=headers.event_id,
            idempotency_key=headers.idempotency_key,
            resource_type=resource_type,
            source_resource_id=source_resource_id,
            payload_sha256=payload_sha256,
            resource_store_id=None,
            processing_status="accepted",
        )
        self.events_by_idempotency[(headers.source_system, headers.idempotency_key)] = event
        self.events_by_event_id[(headers.source_system, headers.event_id)] = event

    def upsert_resource_store(self, *, headers: IngestHeaders, resource) -> str:
        key = (headers.source_system, resource.resource_type, resource.source_resource_id)
        existing = self.resource_store.get(key)
        resource_store_id = existing["id"] if existing else f"rs-{len(self.resource_store) + 1}"
        self.resource_store[key] = {
            "id": resource_store_id,
            "raw_resource": resource.raw_resource,
            "canonical_resource": resource.canonical_resource,
            "canonical_identifiers": resource.canonical_identifiers,
            "checksum_sha256": resource.checksum_sha256,
        }
        return resource_store_id

    def upsert_read_models(self, *, resource_store_id: str, resource) -> None:
        self.read_models[(resource.resource_type, resource_store_id)] = resource.canonical_resource

    def mark_ingestion_event_projected(
        self,
        *,
        source_system: str,
        event_id: str,
        resource_store_id: str | None,
    ) -> None:
        event = self.events_by_event_id[(source_system, event_id)]
        updated = replace(
            event,
            resource_store_id=resource_store_id,
            processing_status="projected",
        )
        self.events_by_event_id[(source_system, event_id)] = updated
        self.events_by_idempotency[(source_system, event.idempotency_key)] = updated


class _FakeResult:
    def __init__(self, *, row=None):
        self._row = row

    def fetchone(self):
        return self._row


class _FakeApiKeyConnection:
    def __init__(self, row):
        self.row = row

    def execute(self, query, params=()):
        normalized = " ".join(query.split())
        if "FROM api_keys" in normalized and "WHERE key_prefix = %s" in normalized:
            expected_prefix = self.row["key_prefix"]
            return _FakeResult(row=self.row if params == (expected_prefix,) else None)
        if normalized == "UPDATE api_keys SET last_used_at = NOW() WHERE id = %s::uuid":
            return _FakeResult()
        raise AssertionError(f"Consulta inesperada no teste: {normalized}")


def _headers(*, event_id="evt-1", idempotency_key="idem-1", source_system="sistema_a") -> IngestHeaders:
    return IngestHeaders(
        source_system=source_system,
        event_id=event_id,
        idempotency_key=idempotency_key,
        api_key_id="11111111-1111-1111-1111-111111111111",
    )


def _client(monkeypatch) -> TestClient:
    monkeypatch.setattr(main_module, "init_db", lambda: None)
    return TestClient(main_module.app)


def _patch_api_key_lookup(monkeypatch, *, source_system="sistema_a"):
    raw_key, key_prefix, key_hash = auth_module.generate_api_key(source_system)
    fake_connection = _FakeApiKeyConnection(
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "name": "Sistema A Prod",
            "source_system": source_system,
            "key_prefix": key_prefix,
            "key_hash": key_hash,
            "scopes": ["fhir.write"],
            "is_active": True,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        }
    )

    @contextmanager
    def fake_conn():
        yield fake_connection

    monkeypatch.setattr(auth_module, "conn", fake_conn)
    return raw_key


def test_ingest_fhir_patient_replay_does_not_duplicate_and_normalizes():
    repository = FakeRepository()
    payload = {
        "resourceType": "Patient",
        "id": "pac-1",
        "identifier": [
            {
                "use": "official",
                "system": CPF_SYSTEM,
                "value": "123.456.789-00",
            }
        ],
        "name": [{"text": "Maria Oliveira"}],
        "gender": "F",
    }

    first = ingest_fhir_resource(
        headers=_headers(),
        payload=payload,
        expected_resource_type="Patient",
        repository=repository,
    )
    replay = ingest_fhir_resource(
        headers=_headers(),
        payload=payload,
        expected_resource_type="Patient",
        repository=repository,
    )

    assert first.created is True
    assert replay.created is False
    assert len(repository.resource_store) == 1
    stored = next(iter(repository.resource_store.values()))
    cpf_identifier = next(
        ident
        for ident in stored["canonical_resource"]["identifier"]
        if ident["system"] == CPF_SYSTEM
    )
    assert cpf_identifier["value"] == "12345678900"
    assert stored["canonical_resource"]["gender"] == "female"
    assert len(repository.events_by_idempotency) == 1
    event = next(iter(repository.events_by_idempotency.values()))
    assert event.processing_status == "projected"
    assert event.resource_store_id == "rs-1"


def test_ingest_fhir_bundle_replay_does_not_duplicate():
    repository = FakeRepository()
    payload = {
        "resourceType": "Bundle",
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": "pac-2",
                    "identifier": [
                        {
                            "use": "official",
                            "system": CPF_SYSTEM,
                            "value": "987.654.321-00",
                        }
                    ],
                    "name": [{"text": "Ana Souza"}],
                }
            },
            {
                "resource": {
                    "resourceType": "Practitioner",
                    "id": "prac-1",
                    "identifier": [
                        {
                            "use": "official",
                            "system": CRM_SYSTEM,
                            "value": "12345-PI",
                        }
                    ],
                    "name": [{"text": "Dr. Pedro"}],
                }
            },
        ],
    }

    first = ingest_fhir_bundle(
        headers=_headers(event_id="evt-bundle", idempotency_key="idem-bundle"),
        payload=payload,
        repository=repository,
    )
    replay = ingest_fhir_bundle(
        headers=_headers(event_id="evt-bundle", idempotency_key="idem-bundle"),
        payload=payload,
        repository=repository,
    )

    assert first.created is True
    assert replay.created is False
    assert first.processed_resources == 2
    assert len(repository.resource_store) == 2
    practitioner = repository.resource_store[("sistema_a", "Practitioner", "prac-1")]
    crm_identifier = next(
        ident
        for ident in practitioner["canonical_resource"]["identifier"]
        if ident["system"] == CRM_SYSTEM
    )
    assert crm_identifier["value"] == "PI12345"
    assert len(repository.events_by_idempotency) == 1


def test_post_fhir_patient_endpoint_is_exposed(monkeypatch):
    raw_key = _patch_api_key_lookup(monkeypatch)

    @contextmanager
    def fake_conn():
        yield object()

    monkeypatch.setattr(fhir_escrita_module, "conn", fake_conn)
    monkeypatch.setattr(fhir_escrita_module, "PostgresFhirRepository", lambda connection: object())
    monkeypatch.setattr(
        fhir_escrita_module,
        "ingest_fhir_resource",
        lambda headers, payload, expected_resource_type, repository: IngestionResult(
            created=True,
            resource_type=expected_resource_type,
            source_system=headers.source_system,
            source_resource_id=payload["id"],
            event_id=headers.event_id,
            idempotency_key=headers.idempotency_key,
            resource_store_id="rs-1",
        ),
    )

    client = _client(monkeypatch)
    response = client.post(
        "/fhir/Patient",
        headers={
            "Content-Type": "application/fhir+json",
            "X-API-Key": raw_key,
            "X-Source-System": "sistema_a",
            "X-Event-Id": "evt-route",
            "Idempotency-Key": "idem-route",
        },
        json={
            "resourceType": "Patient",
            "id": "pac-route",
            "identifier": [
                {
                    "use": "official",
                    "system": CPF_SYSTEM,
                    "value": "12345678900",
                }
            ],
            "name": [{"text": "Paciente Rota"}],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["resourceType"] == "Patient"
    assert body["source_resource_id"] == "pac-route"
