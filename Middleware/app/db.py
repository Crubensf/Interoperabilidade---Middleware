from __future__ import annotations

import re
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from app.config import settings


MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "migrations"
REQUIRED_TABLES = (
    "schema_migrations",
    "api_keys",
    "audit_log",
    "resource_store",
    "ingestion_events",
    "patient_identity_projection",
    "practitioner_identity_projection",
)
_DOLLAR_TAG_RE = re.compile(r"\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$")


@contextmanager
def conn():
    with psycopg.connect(settings.DATABASE_URL, row_factory=dict_row) as connection:
        yield connection


def init_db() -> None:
    run_migrations()
    ok, info = database_health()
    if not ok:
        raise RuntimeError(f"Banco de dados do middleware nao esta pronto: {info}")


def run_migrations() -> None:
    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        raise RuntimeError(f"Nenhuma migration encontrada em {MIGRATIONS_DIR}.")

    for migration_file in migration_files:
        _apply_migration(migration_file)


def database_health() -> tuple[bool, dict]:
    try:
        info = get_database_status()
    except Exception as exc:
        return False, {
            "status": "down",
            "error": str(exc),
        }

    missing = info["missing_tables"]
    if missing:
        info["status"] = "degraded"
        return False, info

    info["status"] = "up"
    return True, info


def get_database_status() -> dict:
    with conn() as connection:
        meta = connection.execute(
            """
            SELECT
              current_database() AS database_name,
              current_schema() AS schema_name
            """
        ).fetchone()

        migration_count = connection.execute(
            "SELECT COUNT(*) AS total FROM schema_migrations"
        ).fetchone()["total"]

        rows = connection.execute(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = current_schema()
              AND tablename = ANY(%s)
            """,
            (list(REQUIRED_TABLES),),
        ).fetchall()
        found = {row["tablename"] for row in rows}

    missing_tables = sorted(set(REQUIRED_TABLES) - found)
    return {
        "database": meta["database_name"],
        "schema": meta["schema_name"],
        "migrations_applied": int(migration_count or 0),
        "missing_tables": missing_tables,
    }


def _apply_migration(path: Path) -> None:
    script = path.read_text(encoding="utf-8")
    statements = _split_sql_statements(script)
    if not statements:
        return

    with conn() as connection:
        for statement in statements:
            normalized = statement.strip().upper()
            if normalized in {"BEGIN", "COMMIT"}:
                continue
            connection.execute(statement)


def _split_sql_statements(script: str) -> list[str]:
    statements: list[str] = []
    buffer: list[str] = []
    dollar_tag: str | None = None
    in_single = False
    in_double = False
    in_line_comment = False
    in_block_comment = False
    i = 0

    while i < len(script):
        ch = script[i]
        nxt = script[i + 1] if i + 1 < len(script) else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue

        if dollar_tag is not None:
            if script.startswith(dollar_tag, i):
                buffer.append(dollar_tag)
                i += len(dollar_tag)
                dollar_tag = None
            else:
                buffer.append(ch)
                i += 1
            continue

        if in_single:
            buffer.append(ch)
            if ch == "'":
                if nxt == "'":
                    buffer.append(nxt)
                    i += 2
                    continue
                in_single = False
            i += 1
            continue

        if in_double:
            buffer.append(ch)
            if ch == '"':
                if nxt == '"':
                    buffer.append(nxt)
                    i += 2
                    continue
                in_double = False
            i += 1
            continue

        if ch == "-" and nxt == "-":
            in_line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

        if ch == "'":
            in_single = True
            buffer.append(ch)
            i += 1
            continue

        if ch == '"':
            in_double = True
            buffer.append(ch)
            i += 1
            continue

        if ch == "$":
            match = _DOLLAR_TAG_RE.match(script, i)
            if match:
                dollar_tag = match.group(0)
                buffer.append(dollar_tag)
                i = match.end()
                continue

        if ch == ";":
            statement = "".join(buffer).strip()
            if statement:
                statements.append(statement)
            buffer = []
            i += 1
            continue

        buffer.append(ch)
        i += 1

    trailing = "".join(buffer).strip()
    if trailing:
        statements.append(trailing)

    return statements
