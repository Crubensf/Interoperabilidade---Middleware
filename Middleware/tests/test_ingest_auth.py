from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

import app.auth as auth_module
import app.main as main_module
import app.rotas.escrita as escrita_module


class _FakeResult:
    def __init__(self, *, row=None, rows=None):
        self._row = row
        self._rows = rows or []

    def fetchone(self):
        return self._row

    def fetchall(self):
        return self._rows


class _FakeApiKeyConnection:
    def __init__(self, row):
        self.row = row
        self.last_used_updated = False

    def execute(self, query, params=()):
        normalized = " ".join(query.split())

        if "FROM api_keys" in normalized and "WHERE key_prefix = %s" in normalized:
            expected_prefix = self.row["key_prefix"]
            return _FakeResult(row=self.row if params == (expected_prefix,) else None)

        if normalized == "UPDATE api_keys SET last_used_at = NOW() WHERE id = %s::uuid":
            self.last_used_updated = True
            return _FakeResult()

        raise AssertionError(f"Consulta inesperada no teste: {normalized}")


def _client(monkeypatch) -> TestClient:
    monkeypatch.setattr(main_module, "init_db", lambda: None)
    return TestClient(main_module.app)


def _patch_api_key_lookup(monkeypatch, *, source_system="sistema_a", scopes=("fhir.write",)):
    raw_key, key_prefix, key_hash = auth_module.generate_api_key(source_system)
    fake_connection = _FakeApiKeyConnection(
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "name": "Sistema A Prod",
            "source_system": source_system,
            "key_prefix": key_prefix,
            "key_hash": key_hash,
            "scopes": list(scopes),
            "is_active": True,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        }
    )

    @contextmanager
    def fake_conn():
        yield fake_connection

    monkeypatch.setattr(auth_module, "conn", fake_conn)
    return raw_key, fake_connection


def test_ingest_without_api_key_fails(monkeypatch):
    client = _client(monkeypatch)

    response = client.post(
        "/pacientes",
        headers={"X-Sistema-Destino": "sistema_a"},
        json={
            "nome": "Maria Oliveira",
            "cartao_sus": "700000000000101",
        },
    )

    assert response.status_code == 401
    assert "X-API-Key" in response.json()["detail"]


def test_ingest_with_valid_api_key_succeeds(monkeypatch):
    async def fake_criar_paciente(payload):
        return {"id": "pac-1", **payload}

    raw_key, fake_connection = _patch_api_key_lookup(monkeypatch)
    monkeypatch.setattr(escrita_module.sistema_a_client, "criar_paciente", fake_criar_paciente)
    monkeypatch.setattr(escrita_module, "invalidar_cache_bundles", lambda origem=None: 1)

    client = _client(monkeypatch)
    response = client.post(
        "/pacientes",
        headers={
            "X-API-Key": raw_key,
            "X-Sistema-Destino": "sistema_a",
        },
        json={
            "nome": "Maria Oliveira",
            "cartao_sus": "700000000000101",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["destino"] == "sistema_a"
    assert body["recurso"]["id"] == "pac-1"
    assert fake_connection.last_used_updated is True


def test_cors_allows_configured_dashboard_origin(monkeypatch):
    client = _client(monkeypatch)

    response = client.options(
        "/pacientes",
        headers={
            "Origin": "http://localhost:8080",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8080"


def test_cors_blocks_unknown_origin(monkeypatch):
    client = _client(monkeypatch)

    response = client.options(
        "/pacientes",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
