"""CRUD sobre o MPI e o audit log."""
from datetime import datetime, timezone
import json

from app.db import conn


def upsert_paciente(
    *,
    cns: str | None,
    cpf: str | None,
    nome: str | None,
    sistema: str,
    sistema_id: str,
) -> None:
    """Insere ou atualiza um paciente no índice, considerando CNS depois CPF como chaves."""
    agora = datetime.now(timezone.utc).isoformat()
    sistema_col = "sistema_a_source_resource_id" if sistema == "sistema_a" else "sistema_b_source_resource_id"
    visto_col = "ultima_visto_a" if sistema == "sistema_a" else "ultima_visto_b"

    with conn() as c:
        row = None
        if cns:
            row = c.execute(
                "SELECT id FROM patient_identity_projection WHERE cns = %s",
                (cns,),
            ).fetchone()
        if row is None and cpf:
            row = c.execute(
                "SELECT id FROM patient_identity_projection WHERE cpf = %s",
                (cpf,),
            ).fetchone()

        if row:
            c.execute(
                f"""
                UPDATE patient_identity_projection
                SET {sistema_col} = %s,
                    {visto_col} = %s,
                    preferred_name = COALESCE(%s, preferred_name),
                    cns = COALESCE(%s, cns),
                    cpf = COALESCE(%s, cpf)
                WHERE id = %s
                """,
                (sistema_id, agora, nome, cns, cpf, row["id"]),
            )
        else:
            c.execute(
                f"""
                INSERT INTO patient_identity_projection
                  (cns, cpf, preferred_name, {sistema_col}, {visto_col})
                VALUES (%s, %s, %s, %s, %s)
                """,
                (cns, cpf, nome, sistema_id, agora),
            )


def upsert_profissional(*, crm: str, nome: str | None, sistema: str, sistema_id: str) -> None:
    sistema_col = "sistema_a_source_resource_id" if sistema == "sistema_a" else "sistema_b_source_resource_id"
    agora = datetime.now(timezone.utc).isoformat()
    with conn() as c:
        row = c.execute(
            "SELECT id FROM practitioner_identity_projection WHERE crm = %s",
            (crm,),
        ).fetchone()
        if row:
            c.execute(
                f"""
                UPDATE practitioner_identity_projection
                SET {sistema_col} = %s,
                    preferred_name = COALESCE(%s, preferred_name),
                    {('ultima_visto_a' if sistema == 'sistema_a' else 'ultima_visto_b')} = %s
                WHERE id = %s
                """,
                (sistema_id, nome, agora, row["id"]),
            )
        else:
            c.execute(
                f"""
                INSERT INTO practitioner_identity_projection
                  (crm, preferred_name, {sistema_col}, {('ultima_visto_a' if sistema == 'sistema_a' else 'ultima_visto_b')})
                VALUES (%s, %s, %s, %s)
                """,
                (crm, nome, sistema_id, agora),
            )


def listar_pacientes_indexados(somente_duplicados: bool = False) -> list[dict]:
    sql = """
        SELECT
          id::text AS id,
          cns,
          cpf,
          preferred_name AS nome,
          sistema_a_source_resource_id AS sistema_a_id,
          sistema_b_source_resource_id AS sistema_b_id,
          ultima_visto_a,
          ultima_visto_b,
          updated_at AS atualizado_em
        FROM patient_identity_projection
    """
    if somente_duplicados:
        sql += """
            WHERE sistema_a_source_resource_id IS NOT NULL
              AND sistema_b_source_resource_id IS NOT NULL
        """
    sql += " ORDER BY updated_at DESC"
    with conn() as c:
        return list(c.execute(sql).fetchall())


def listar_profissionais_indexados(somente_duplicados: bool = False) -> list[dict]:
    sql = """
        SELECT
          id::text AS id,
          crm,
          preferred_name AS nome,
          sistema_a_source_resource_id AS sistema_a_id,
          sistema_b_source_resource_id AS sistema_b_id,
          updated_at AS atualizado_em
        FROM practitioner_identity_projection
    """
    if somente_duplicados:
        sql += """
            WHERE sistema_a_source_resource_id IS NOT NULL
              AND sistema_b_source_resource_id IS NOT NULL
        """
    sql += " ORDER BY updated_at DESC"
    with conn() as c:
        return list(c.execute(sql).fetchall())


def registrar_audit(
    metodo: str,
    caminho: str,
    status: int,
    duracao_ms: int,
    cliente: str | None,
    *,
    api_key_id: str | None = None,
    source_system: str | None = None,
    event_id: str | None = None,
    idempotency_key: str | None = None,
    details: dict | None = None,
) -> None:
    with conn() as c:
        c.execute(
            """
            INSERT INTO audit_log (
              api_key_id,
              source_system,
              event_id,
              idempotency_key,
              method,
              path,
              status,
              duration_ms,
              client_cidr,
              details
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NULLIF(%s, '')::inet, %s::jsonb)
            """,
            (
                api_key_id,
                source_system,
                event_id,
                idempotency_key,
                metodo,
                caminho,
                status,
                duracao_ms,
                cliente,
                json.dumps(details or {}),
            ),
        )


def listar_audit(limit: int = 100) -> list[dict]:
    with conn() as c:
        return list(
            c.execute(
                """
                SELECT
                  id,
                  ts,
                  method AS metodo,
                  path AS caminho,
                  status,
                  duration_ms AS duracao_ms,
                  HOST(client_cidr) AS cliente,
                  source_system,
                  event_id,
                  idempotency_key
                FROM audit_log
                ORDER BY ts DESC
                LIMIT %s
                """,
                (limit,),
            ).fetchall()
        )


_AUDIT_NOISE_PATHS = ["/health", "/ready", "/dashboard", "/favicon.ico", "/"]


def estatisticas_audit() -> dict:
    with conn() as c:
        total_geral = c.execute("SELECT COUNT(*) AS n FROM audit_log").fetchone()["n"]
        row = c.execute(
            """
            SELECT
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status >= 500) AS erros_servidor,
              COUNT(*) FILTER (WHERE status BETWEEN 400 AND 499) AS rejeicoes_cliente,
              COUNT(*) FILTER (WHERE status IN (401, 403)) AS nao_autorizado,
              AVG(duration_ms) AS duracao_media,
              COUNT(*) FILTER (WHERE ts >= NOW() - INTERVAL '1 hour') AS ultimo_hora,
              COUNT(*) FILTER (
                WHERE ts >= NOW() - INTERVAL '1 hour' AND status >= 500
              ) AS erros_servidor_hora
            FROM audit_log
            WHERE path <> ALL(%s)
              AND path NOT LIKE '/static/%%'
            """,
            (_AUDIT_NOISE_PATHS,),
        ).fetchone()

    total = int(row["total"] or 0)
    erros_servidor = int(row["erros_servidor"] or 0)
    rejeicoes_cliente = int(row["rejeicoes_cliente"] or 0)
    nao_autorizado = int(row["nao_autorizado"] or 0)
    media = round(row["duracao_media"] or 0, 1)
    ultimo_hora = int(row["ultimo_hora"] or 0)
    erros_servidor_hora = int(row["erros_servidor_hora"] or 0)

    def _pct(numer: int, denom: int) -> float:
        return round((numer / denom) * 100, 1) if denom else 0.0

    return {
        "total": total,
        "total_geral_inclui_health": int(total_geral or 0),
        "erros_servidor": erros_servidor,
        "rejeicoes_cliente": rejeicoes_cliente,
        "nao_autorizado": nao_autorizado,
        "taxa_erro_servidor_pct": _pct(erros_servidor, total),
        "taxa_rejeicao_cliente_pct": _pct(rejeicoes_cliente, total),
        "duracao_media_ms": media,
        "janela_1h": {
            "requisicoes": ultimo_hora,
            "erros_servidor": erros_servidor_hora,
            "taxa_erro_pct": _pct(erros_servidor_hora, ultimo_hora),
        },
        # campo legado pra compat com chamadas antigas; agora reflete só erros de servidor.
        "erros": erros_servidor,
    }
