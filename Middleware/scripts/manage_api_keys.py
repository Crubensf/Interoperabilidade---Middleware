#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.auth import (  # noqa: E402
    DEFAULT_INGEST_SCOPES,
    SUPPORTED_SOURCE_SYSTEMS,
    create_api_key,
    list_api_keys,
    rotate_api_key,
    set_api_key_active,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Gerencia API keys do middleware.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create", help="Cria uma nova API key.")
    create_parser.add_argument("--name", required=True, help="Nome legivel da chave.")
    create_parser.add_argument(
        "--source-system",
        required=True,
        choices=SUPPORTED_SOURCE_SYSTEMS,
        help="Produtor associado a chave.",
    )
    create_parser.add_argument(
        "--scope",
        action="append",
        dest="scopes",
        default=[],
        help="Escopo da chave. Repita a opcao para varios escopos.",
    )
    create_parser.add_argument("--description", help="Descricao opcional.")
    create_parser.add_argument(
        "--expires-at",
        help="Data/hora de expiracao em ISO 8601, por exemplo 2026-07-01T00:00:00+00:00.",
    )

    list_parser = subparsers.add_parser("list", help="Lista API keys.")
    list_parser.add_argument("--source-system", choices=SUPPORTED_SOURCE_SYSTEMS)
    list_parser.add_argument(
        "--active-only",
        action="store_true",
        help="Lista apenas chaves ativas.",
    )

    deactivate_parser = subparsers.add_parser("deactivate", help="Desativa uma API key.")
    deactivate_parser.add_argument("--id", required=True, help="UUID da chave.")

    activate_parser = subparsers.add_parser("activate", help="Reativa uma API key.")
    activate_parser.add_argument("--id", required=True, help="UUID da chave.")

    rotate_parser = subparsers.add_parser("rotate", help="Cria nova chave para rotacao.")
    rotate_parser.add_argument("--id", required=True, help="UUID da chave atual.")
    rotate_parser.add_argument(
        "--deactivate-old",
        action="store_true",
        help="Ja desativa a chave antiga apos criar a nova.",
    )
    rotate_parser.add_argument(
        "--expires-at",
        help="Data/hora de expiracao em ISO 8601 para a nova chave.",
    )

    args = parser.parse_args()

    if args.command == "create":
        expires_at = _parse_dt(args.expires_at) if args.expires_at else None
        scopes = args.scopes or list(DEFAULT_INGEST_SCOPES)
        identity, raw_key = create_api_key(
            name=args.name,
            source_system=args.source_system,
            scopes=scopes,
            description=args.description,
            expires_at=expires_at,
        )
        print("API key criada com sucesso.")
        print(f"id: {identity.id}")
        print(f"name: {identity.name}")
        print(f"source_system: {identity.source_system}")
        print(f"scopes: {', '.join(identity.scopes)}")
        print(f"key_prefix: {identity.key_prefix}")
        print(f"raw_key: {raw_key}")
        print("Guarde a raw_key agora; ela nao pode ser recuperada depois.")
        return 0

    if args.command == "list":
        rows = list_api_keys(
            source_system=args.source_system,
            include_inactive=not args.active_only,
        )
        if not rows:
            print("Nenhuma API key encontrada.")
            return 0
        for row in rows:
            scopes = ", ".join(row["scopes"] or [])
            print(
                " | ".join(
                    [
                        row["id"],
                        row["source_system"],
                        row["name"],
                        row["key_prefix"],
                        "active" if row["is_active"] else "inactive",
                        scopes or "-",
                        str(row["last_used_at"] or "-"),
                    ]
                )
            )
        return 0

    if args.command == "deactivate":
        row = set_api_key_active(args.id, is_active=False)
        print(f"API key desativada: {row['id']} ({row['name']})")
        return 0

    if args.command == "activate":
        row = set_api_key_active(args.id, is_active=True)
        print(f"API key ativada: {row['id']} ({row['name']})")
        return 0

    if args.command == "rotate":
        expires_at = _parse_dt(args.expires_at) if args.expires_at else None
        identity, raw_key = rotate_api_key(
            args.id,
            deactivate_old=args.deactivate_old,
            expires_at=expires_at,
        )
        print("Nova API key gerada para rotacao.")
        print(f"id: {identity.id}")
        print(f"source_system: {identity.source_system}")
        print(f"scopes: {', '.join(identity.scopes)}")
        print(f"key_prefix: {identity.key_prefix}")
        print(f"raw_key: {raw_key}")
        if args.deactivate_old:
            print("A chave antiga foi desativada.")
        else:
            print("A chave antiga permanece ativa ate o corte manual.")
        return 0

    parser.error("Comando nao suportado.")
    return 2


def _parse_dt(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise SystemExit(f"Data invalida: {value}") from exc


if __name__ == "__main__":
    raise SystemExit(main())
