import asyncio
from contextlib import contextmanager
from dataclasses import replace

import app.agregador as agregador_module
from app.fhir.ingestion import CPF_SYSTEM, ShadowPersistResult, StoredEvent, persist_shadow_entries


class FakeRepository:
    def __init__(self):
        self.events_by_idempotency: dict[tuple[str, str], StoredEvent] = {}
        self.events_by_event_id: dict[tuple[str, str], StoredEvent] = {}
        self.resource_store: dict[tuple[str, str, str], dict] = {}

    def find_event_by_idempotency(self, *, source_system: str, idempotency_key: str) -> StoredEvent | None:
        return self.events_by_idempotency.get((source_system, idempotency_key))

    def find_event_by_event_id(self, *, source_system: str, event_id: str) -> StoredEvent | None:
        return self.events_by_event_id.get((source_system, event_id))

    def insert_ingestion_event(
        self,
        *,
        headers,
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

    def upsert_resource_store(self, *, headers, resource) -> str:
        key = (headers.source_system, resource.resource_type, resource.source_resource_id)
        existing = self.resource_store.get(key)
        resource_store_id = existing["id"] if existing else f"rs-{len(self.resource_store) + 1}"
        self.resource_store[key] = {
            "id": resource_store_id,
            "raw_resource": resource.raw_resource,
            "canonical_resource": resource.canonical_resource,
        }
        return resource_store_id

    def upsert_read_models(self, *, resource_store_id: str, resource) -> None:
        return None

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


class _FakeConnection:
    @contextmanager
    def transaction(self):
        yield self


def _patient_entry() -> dict:
    return {
        "resource": {
            "resourceType": "Patient",
            "id": "shadow-pac-1",
            "identifier": [
                {
                    "use": "official",
                    "system": CPF_SYSTEM,
                    "value": "123.456.789-00",
                }
            ],
            "name": [{"text": "Maria Shadow"}],
        }
    }


def test_persist_shadow_entries_replays_same_snapshot_without_duplicate():
    repository = FakeRepository()

    @contextmanager
    def fake_conn():
        yield _FakeConnection()

    first = persist_shadow_entries(
        [_patient_entry()],
        source_system="sistema_a",
        repository_factory=lambda connection: repository,
        connection_factory=fake_conn,
    )
    replay = persist_shadow_entries(
        [_patient_entry()],
        source_system="sistema_a",
        repository_factory=lambda connection: repository,
        connection_factory=fake_conn,
    )

    assert first == ShadowPersistResult(processed_resources=1, created=1, replayed=0, failed=0)
    assert replay == ShadowPersistResult(processed_resources=1, created=0, replayed=1, failed=0)
    assert len(repository.resource_store) == 1
    stored = repository.resource_store[("sistema_a", "Patient", "shadow-pac-1")]
    identifier = stored["canonical_resource"]["identifier"][0]
    assert identifier["value"] == "12345678900"
    assert len(repository.events_by_idempotency) == 1


def test_coletar_entries_shadow_mode_keeps_live_read(monkeypatch):
    captured: list[tuple[str, list[dict]]] = []

    async def fake_bundle():
        return {
            "resourceType": "Bundle",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Patient",
                        "id": "pac-live-1",
                        "identifier": [
                            {
                                "use": "official",
                                "system": CPF_SYSTEM,
                                "value": "98765432100",
                            }
                        ],
                        "name": [{"text": "Paciente Live"}],
                    }
                }
            ],
        }

    def fake_shadow_persist(entries, *, source_system):
        captured.append((source_system, entries))
        return ShadowPersistResult(processed_resources=1, created=1, replayed=0, failed=0)

    monkeypatch.setattr(agregador_module.sistema_a_client, "bundle_fhir", fake_bundle)
    monkeypatch.setattr(agregador_module, "persist_shadow_entries", fake_shadow_persist)
    monkeypatch.setattr(agregador_module.settings, "SHADOW_PERSIST_READS", True)
    agregador_module.bundle_cache.invalidate()

    entries = asyncio.run(agregador_module.coletar_entries(origem="sistema_a"))

    assert len(entries) == 1
    assert entries[0]["resource"]["id"] == "pac-live-1"
    assert captured and captured[0][0] == "sistema_a"
    agregador_module.bundle_cache.invalidate()


def test_coletar_entries_ignores_shadow_persist_failure(monkeypatch):
    async def fake_bundle():
        return {
            "resourceType": "Bundle",
            "entry": [
                {
                    "resource": {
                        "resourceType": "Patient",
                        "id": "pac-live-2",
                        "identifier": [
                            {
                                "use": "official",
                                "system": CPF_SYSTEM,
                                "value": "11122233344",
                            }
                        ],
                        "name": [{"text": "Paciente Tolerado"}],
                    }
                }
            ],
        }

    def broken_shadow_persist(entries, *, source_system):
        raise RuntimeError("falha proposital")

    monkeypatch.setattr(agregador_module.sistema_a_client, "bundle_fhir", fake_bundle)
    monkeypatch.setattr(agregador_module, "persist_shadow_entries", broken_shadow_persist)
    monkeypatch.setattr(agregador_module.settings, "SHADOW_PERSIST_READS", True)
    agregador_module.bundle_cache.invalidate()

    entries = asyncio.run(agregador_module.coletar_entries(origem="sistema_a"))

    assert len(entries) == 1
    assert entries[0]["resource"]["id"] == "pac-live-2"
    agregador_module.bundle_cache.invalidate()
