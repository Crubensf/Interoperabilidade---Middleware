from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Sequence
from uuid import UUID

from fastapi import Header, HTTPException, Request, status

from app.db import conn


SUPPORTED_SOURCE_SYSTEMS = ("sistema_a", "sistema_b")
DEFAULT_INGEST_SCOPES = ("fhir.write",)
API_KEY_HEADER_NAME = "X-API-Key"
KEY_PREFIX_NAMESPACE = "mwi"


class ApiKeyAuthError(Exception):
    def __init__(self, detail: str, status_code: int) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


@dataclass(frozen=True)
class ApiKeyIdentity:
    id: str
    name: str
    source_system: str
    scopes: tuple[str, ...]
    key_prefix: str


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_api_key(source_system: str) -> tuple[str, str, str]:
    _validate_source_system(source_system)
    prefix = f"{KEY_PREFIX_NAMESPACE}.{source_system}.{secrets.token_hex(6)}"
    secret = secrets.token_urlsafe(32)
    raw_key = f"{prefix}.{secret}"
    return raw_key, prefix, hash_api_key(raw_key)


def normalize_scopes(scopes: Iterable[str] | None) -> tuple[str, ...]:
    raw = scopes or DEFAULT_INGEST_SCOPES
    normalized = []
    seen = set()
    for scope in raw:
        value = str(scope or "").strip()
        if not value or value in seen:
            continue
        normalized.append(value)
        seen.add(value)
    if not normalized:
        return tuple(DEFAULT_INGEST_SCOPES)
    return tuple(normalized)


def create_api_key(
    *,
    name: str,
    source_system: str,
    scopes: Iterable[str] | None = None,
    description: str | None = None,
    expires_at: datetime | None = None,
) -> tuple[ApiKeyIdentity, str]:
    _validate_source_system(source_system)
    normalized_scopes = normalize_scopes(scopes)
    raw_key, key_prefix, key_hash = generate_api_key(source_system)

    with conn() as connection:
        row = connection.execute(
            """
            INSERT INTO api_keys (
              name,
              source_system,
              key_prefix,
              key_hash,
              scopes,
              description,
              expires_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id::text AS id, name, source_system, key_prefix, scopes
            """,
            (
                name.strip(),
                source_system,
                key_prefix,
                key_hash,
                list(normalized_scopes),
                description,
                expires_at,
            ),
        ).fetchone()

    identity = ApiKeyIdentity(
        id=row["id"],
        name=row["name"],
        source_system=row["source_system"],
        scopes=tuple(row["scopes"] or []),
        key_prefix=row["key_prefix"],
    )
    return identity, raw_key


def list_api_keys(
    *,
    source_system: str | None = None,
    include_inactive: bool = True,
) -> list[dict]:
    clauses = []
    params: list[object] = []

    if source_system:
        _validate_source_system(source_system)
        clauses.append("source_system = %s")
        params.append(source_system)
    if not include_inactive:
        clauses.append("is_active = TRUE")

    sql = """
        SELECT
          id::text AS id,
          name,
          source_system,
          key_prefix,
          scopes,
          description,
          is_active,
          expires_at,
          last_used_at,
          created_at,
          updated_at
        FROM api_keys
    """
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY created_at DESC"

    with conn() as connection:
        return list(connection.execute(sql, tuple(params)).fetchall())


def set_api_key_active(key_id: str | UUID, *, is_active: bool) -> dict:
    with conn() as connection:
        row = connection.execute(
            """
            UPDATE api_keys
            SET is_active = %s
            WHERE id = %s::uuid
            RETURNING
              id::text AS id,
              name,
              source_system,
              key_prefix,
              scopes,
              is_active,
              expires_at,
              last_used_at,
              created_at,
              updated_at
            """,
            (is_active, str(key_id)),
        ).fetchone()
    if not row:
        raise ValueError(f"API key nao encontrada: {key_id}")
    return row


def rotate_api_key(
    key_id: str | UUID,
    *,
    deactivate_old: bool = False,
    expires_at: datetime | None = None,
) -> tuple[ApiKeyIdentity, str]:
    with conn() as connection:
        current = connection.execute(
            """
            SELECT id::text AS id, name, source_system, scopes, description
            FROM api_keys
            WHERE id = %s::uuid
            """,
            (str(key_id),),
        ).fetchone()
        if not current:
            raise ValueError(f"API key nao encontrada: {key_id}")

    identity, raw_key = create_api_key(
        name=f"{current['name']} (rotacionada)",
        source_system=current["source_system"],
        scopes=current["scopes"] or DEFAULT_INGEST_SCOPES,
        description=current["description"],
        expires_at=expires_at,
    )
    if deactivate_old:
        set_api_key_active(key_id, is_active=False)
    return identity, raw_key


def authenticate_api_key(
    raw_key: str,
    *,
    required_scopes: Sequence[str] = DEFAULT_INGEST_SCOPES,
) -> ApiKeyIdentity:
    if not raw_key:
        raise ApiKeyAuthError(
            f"{API_KEY_HEADER_NAME} ausente ou invalida.",
            status.HTTP_401_UNAUTHORIZED,
        )

    key_prefix = extract_key_prefix(raw_key)
    now = datetime.now(timezone.utc)

    with conn() as connection:
        row = connection.execute(
            """
            SELECT
              id::text AS id,
              name,
              source_system,
              key_prefix,
              key_hash,
              scopes,
              is_active,
              expires_at
            FROM api_keys
            WHERE key_prefix = %s
            """,
            (key_prefix,),
        ).fetchone()

        if not row:
            raise ApiKeyAuthError(
                f"{API_KEY_HEADER_NAME} ausente ou invalida.",
                status.HTTP_401_UNAUTHORIZED,
            )

        if not row["is_active"]:
            raise ApiKeyAuthError(
                "API key inativa.",
                status.HTTP_401_UNAUTHORIZED,
            )

        expires_at = row["expires_at"]
        if expires_at and expires_at <= now:
            raise ApiKeyAuthError(
                "API key expirada.",
                status.HTTP_401_UNAUTHORIZED,
            )

        expected_hash = row["key_hash"] or ""
        provided_hash = hash_api_key(raw_key)
        if not hmac.compare_digest(provided_hash, expected_hash):
            raise ApiKeyAuthError(
                f"{API_KEY_HEADER_NAME} ausente ou invalida.",
                status.HTTP_401_UNAUTHORIZED,
            )

        scopes = tuple(row["scopes"] or [])
        missing_scopes = [scope for scope in required_scopes if scope not in scopes]
        if missing_scopes:
            raise ApiKeyAuthError(
                f"API key sem escopo necessario: {', '.join(missing_scopes)}.",
                status.HTTP_403_FORBIDDEN,
            )

        connection.execute(
            "UPDATE api_keys SET last_used_at = NOW() WHERE id = %s::uuid",
            (row["id"],),
        )

    return ApiKeyIdentity(
        id=row["id"],
        name=row["name"],
        source_system=row["source_system"],
        scopes=scopes,
        key_prefix=row["key_prefix"],
    )


def require_api_key(
    *,
    required_scopes: Sequence[str] = DEFAULT_INGEST_SCOPES,
):
    async def dependency(
        request: Request,
        x_api_key: str | None = Header(default=None, alias=API_KEY_HEADER_NAME),
    ) -> ApiKeyIdentity:
        try:
            identity = authenticate_api_key(
                x_api_key or "",
                required_scopes=required_scopes,
            )
        except ApiKeyAuthError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

        header_source_system = (request.headers.get("X-Source-System") or "").strip()
        if header_source_system and header_source_system != identity.source_system:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="X-Source-System nao corresponde a API key informada.",
            )

        request.state.api_key_id = identity.id
        request.state.api_key_name = identity.name
        request.state.source_system = identity.source_system
        request.state.api_key_scopes = identity.scopes
        return identity

    return dependency


def extract_key_prefix(raw_key: str) -> str:
    parts = str(raw_key or "").strip().split(".")
    if len(parts) != 4 or parts[0] != KEY_PREFIX_NAMESPACE:
        raise ApiKeyAuthError(
            f"{API_KEY_HEADER_NAME} ausente ou invalida.",
            status.HTTP_401_UNAUTHORIZED,
        )

    source_system = parts[1]
    try:
        _validate_source_system(source_system)
    except ValueError as exc:
        raise ApiKeyAuthError(
            f"{API_KEY_HEADER_NAME} ausente ou invalida.",
            status.HTTP_401_UNAUTHORIZED,
        ) from exc
    return ".".join(parts[:3])


def _validate_source_system(source_system: str) -> None:
    if source_system not in SUPPORTED_SOURCE_SYSTEMS:
        raise ValueError(f"source_system invalido: {source_system}")
