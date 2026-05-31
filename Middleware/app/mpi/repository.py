"""CRUD sobre o MPI."""
from datetime import datetime, timezone

from app.mpi.database import conn


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
    sistema_col = "sistema_a_id" if sistema == "sistema_a" else "sistema_b_id"
    visto_col = "ultima_visto_a" if sistema == "sistema_a" else "ultima_visto_b"

    with conn() as c:
        row = None
        if cns:
            row = c.execute("SELECT id FROM pacientes_index WHERE cns = ?", (cns,)).fetchone()
        if row is None and cpf:
            row = c.execute("SELECT id FROM pacientes_index WHERE cpf = ?", (cpf,)).fetchone()

        if row:
            c.execute(
                f"UPDATE pacientes_index SET {sistema_col}=?, {visto_col}=?, "
                f"nome=COALESCE(?, nome), cns=COALESCE(?, cns), cpf=COALESCE(?, cpf), "
                f"atualizado_em=? WHERE id=?",
                (sistema_id, agora, nome, cns, cpf, agora, row["id"]),
            )
        else:
            c.execute(
                f"INSERT INTO pacientes_index (cns, cpf, nome, {sistema_col}, {visto_col}, atualizado_em) "
                f"VALUES (?, ?, ?, ?, ?, ?)",
                (cns, cpf, nome, sistema_id, agora, agora),
            )


def upsert_profissional(*, crm: str, nome: str | None, sistema: str, sistema_id: str) -> None:
    sistema_col = "sistema_a_id" if sistema == "sistema_a" else "sistema_b_id"
    agora = datetime.now(timezone.utc).isoformat()
    with conn() as c:
        row = c.execute("SELECT id FROM profissionais_index WHERE crm=?", (crm,)).fetchone()
        if row:
            c.execute(
                f"UPDATE profissionais_index SET {sistema_col}=?, nome=COALESCE(?, nome), atualizado_em=? WHERE id=?",
                (sistema_id, nome, agora, row["id"]),
            )
        else:
            c.execute(
                f"INSERT INTO profissionais_index (crm, nome, {sistema_col}, atualizado_em) VALUES (?, ?, ?, ?)",
                (crm, nome, sistema_id, agora),
            )


def listar_pacientes_indexados(somente_duplicados: bool = False) -> list[dict]:
    sql = "SELECT * FROM pacientes_index"
    if somente_duplicados:
        sql += " WHERE sistema_a_id IS NOT NULL AND sistema_b_id IS NOT NULL"
    sql += " ORDER BY atualizado_em DESC"
    with conn() as c:
        return [dict(r) for r in c.execute(sql)]


def listar_profissionais_indexados(somente_duplicados: bool = False) -> list[dict]:
    sql = "SELECT * FROM profissionais_index"
    if somente_duplicados:
        sql += " WHERE sistema_a_id IS NOT NULL AND sistema_b_id IS NOT NULL"
    sql += " ORDER BY atualizado_em DESC"
    with conn() as c:
        return [dict(r) for r in c.execute(sql)]


def registrar_audit(metodo: str, caminho: str, status: int, duracao_ms: int, cliente: str | None) -> None:
    with conn() as c:
        c.execute(
            "INSERT INTO audit_log (metodo, caminho, status, duracao_ms, cliente) VALUES (?, ?, ?, ?, ?)",
            (metodo, caminho, status, duracao_ms, cliente),
        )


def listar_audit(limit: int = 100) -> list[dict]:
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM audit_log ORDER BY ts DESC LIMIT ?", (limit,))]


def estatisticas_audit() -> dict:
    with conn() as c:
        total = c.execute("SELECT COUNT(*) AS n FROM audit_log").fetchone()["n"]
        erros = c.execute("SELECT COUNT(*) AS n FROM audit_log WHERE status >= 400").fetchone()["n"]
        media = c.execute("SELECT AVG(duracao_ms) AS m FROM audit_log").fetchone()["m"]
    return {"total": total, "erros": erros, "duracao_media_ms": round(media or 0, 1)}
