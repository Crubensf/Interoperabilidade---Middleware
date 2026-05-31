"""Master Patient Index persistido em SQLite.

Mapeia identifiers naturais (CNS, CPF, CRM) para os IDs internos dos sistemas A e B,
permitindo que a de-duplicação sobreviva entre requisições.
"""
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "mpi.db"


SCHEMA = """
CREATE TABLE IF NOT EXISTS pacientes_index (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cns             TEXT,
  cpf             TEXT,
  nome            TEXT,
  sistema_a_id    TEXT,
  sistema_b_id    TEXT,
  ultima_visto_a  TEXT,
  ultima_visto_b  TEXT,
  atualizado_em   TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(cns) ON CONFLICT IGNORE,
  UNIQUE(cpf) ON CONFLICT IGNORE
);

CREATE TABLE IF NOT EXISTS profissionais_index (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  crm             TEXT UNIQUE,
  nome            TEXT,
  sistema_a_id    TEXT,
  sistema_b_id    TEXT,
  atualizado_em   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              TEXT DEFAULT CURRENT_TIMESTAMP,
  metodo          TEXT,
  caminho         TEXT,
  status          INTEGER,
  duracao_ms      INTEGER,
  cliente         TEXT
);

CREATE INDEX IF NOT EXISTS idx_pacientes_cns ON pacientes_index(cns);
CREATE INDEX IF NOT EXISTS idx_pacientes_cpf ON pacientes_index(cpf);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
"""


def init_db() -> None:
    with conn() as c:
        c.executescript(SCHEMA)


@contextmanager
def conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()
