"""Compat layer do banco do middleware.

SQLite foi removido. O middleware agora depende apenas de Postgres.
"""

from app.db import conn, database_health, get_database_status, init_db

__all__ = ["conn", "database_health", "get_database_status", "init_db"]
