from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.mpi.repository import estatisticas_audit, listar_audit

router = APIRouter(tags=["Dashboard"])

STATIC = Path(__file__).parent.parent / "static"


def _asset_version() -> str:
    """Token estavel por execucao do servidor: muda a cada deploy/restart,
    forca o browser a buscar CSS/JS novos sem precisar de Ctrl+Shift+R."""
    try:
        css_mtime = (STATIC / "style.css").stat().st_mtime
        js_mtime = (STATIC / "dashboard.js").stat().st_mtime
        return str(int(max(css_mtime, js_mtime)))
    except OSError:
        return "0"


_VERSION = _asset_version()


@router.get("/dashboard", include_in_schema=False)
def dashboard():
    html = (STATIC / "dashboard.html").read_text(encoding="utf-8")
    html = html.replace("/static/style.css", f"/static/style.css?v={_VERSION}")
    html = html.replace("/static/dashboard.js", f"/static/dashboard.js?v={_VERSION}")
    return HTMLResponse(html)


@router.get("/audit")
def audit(limit: int = 100):
    return listar_audit(limit=limit)


@router.get("/audit/stats")
def audit_stats():
    return estatisticas_audit()
