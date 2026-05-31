from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.mpi.repository import estatisticas_audit, listar_audit

router = APIRouter(tags=["Dashboard"])

STATIC = Path(__file__).parent.parent / "static"


@router.get("/dashboard", include_in_schema=False)
def dashboard():
    return FileResponse(STATIC / "dashboard.html")


@router.get("/audit")
def audit(limit: int = 100):
    return listar_audit(limit=limit)


@router.get("/audit/stats")
def audit_stats():
    return estatisticas_audit()
