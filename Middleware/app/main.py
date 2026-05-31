import asyncio
import re
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.clients.sistema_a import sistema_a_client
from app.clients.sistema_b import sistema_b_client
from app.mpi.database import init_db
from app.mpi.repository import registrar_audit
from app.rotas.pacientes import router as pacientes_router
from app.rotas.profissionais import router as profissionais_router
from app.rotas.agendamentos import router as agendamentos_router
from app.rotas.bundle import router as bundle_router
from app.rotas.metadata import router as metadata_router
from app.rotas.qualidade import router as qualidade_router
from app.rotas.escrita import router as escrita_router
from app.rotas.dashboard import router as dashboard_router
from app.rotas.detalhe import router as detalhe_router


app = FastAPI(
    title="Middleware de Interoperabilidade — Sistema A ↔ Sistema B",
    description=(
        "Gateway FHIR R4 que consolida pacientes, profissionais e agendamentos "
        "de dois sistemas. Inclui dashboard, MPI, qualidade de dados e write-through."
    ),
    version="0.2.0",
)

init_db()

origins = ["*"] if settings.CORS_ORIGINS.strip() == "*" else [
    o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================================
# PII redaction (LGPD) — campos sensíveis nunca devem ir para o audit log
# =====================================================================
_PII_QUERY_KEYS = {"identifier", "cpf", "cartao_sus", "cns", "email", "telefone"}
_LONG_DIGITS = re.compile(r"\b\d{6,}\b")


def _redact_query(query: str) -> str:
    if not query:
        return ""
    pares = []
    for par in query.split("&"):
        if "=" not in par:
            pares.append(par)
            continue
        k, v = par.split("=", 1)
        if k.lower() in _PII_QUERY_KEYS:
            v = "[REDACTED]"
        else:
            v = _LONG_DIGITS.sub("[REDACTED]", v)
        pares.append(f"{k}={v}")
    return "&".join(pares)


def _redact_path(path: str) -> str:
    # protege ids longos numéricos diretamente no path (ex.: /pacientes/000111222)
    return _LONG_DIGITS.sub("[REDACTED]", path)


def _redact_cliente(ip: str | None) -> str | None:
    # mantém só /24 do IPv4; para IPv6 mascara últimos 4 grupos
    if not ip:
        return None
    if ":" in ip:
        parts = ip.split(":")
        return ":".join(parts[:4] + ["xxxx"] * (len(parts) - 4)) if len(parts) > 4 else ip
    octs = ip.split(".")
    if len(octs) == 4:
        return ".".join(octs[:3] + ["0"])
    return ip


@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    inicio = time.perf_counter()
    response = await call_next(request)
    duracao_ms = int((time.perf_counter() - inicio) * 1000)
    caminho = _redact_path(request.url.path)
    qs = _redact_query(request.url.query)
    if qs:
        caminho = f"{caminho}?{qs}"
    if not (request.url.path.startswith("/static") or request.url.path in {"/docs", "/redoc", "/openapi.json"}):
        try:
            registrar_audit(
                metodo=request.method,
                caminho=caminho,
                status=response.status_code,
                duracao_ms=duracao_ms,
                cliente=_redact_cliente(request.client.host if request.client else None),
            )
        except Exception:
            pass
    return response


STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(pacientes_router)
app.include_router(detalhe_router)
app.include_router(escrita_router)
app.include_router(profissionais_router)
app.include_router(agendamentos_router)
app.include_router(bundle_router)
app.include_router(metadata_router)
app.include_router(qualidade_router)
app.include_router(dashboard_router)


@app.get("/", include_in_schema=False)
def raiz():
    return RedirectResponse(url="/dashboard")


@app.get("/info", tags=["Meta"])
def info():
    return {
        "servico": "middleware-interoperabilidade",
        "versao": "0.2.0",
        "dashboard": "/dashboard",
        "swagger": "/docs",
        "fhir_metadata": "/metadata",
        "fontes": {
            "sistema_a": settings.SISTEMA_A_BASE_URL,
            "sistema_b": settings.SISTEMA_B_BASE_URL,
        },
    }


@app.get("/health", tags=["Meta"])
async def health():
    a_ok, b_ok = await asyncio.gather(
        sistema_a_client.health(),
        sistema_b_client.health(),
    )
    status = "ok" if a_ok and b_ok else "degraded"
    return {
        "status": status,
        "sistema_a": "up" if a_ok else "down",
        "sistema_b": "up" if b_ok else "down",
        "urls": {
            "sistema_a": settings.SISTEMA_A_BASE_URL,
            "sistema_b": settings.SISTEMA_B_BASE_URL,
        },
    }
