from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.agregador import invalidar_cache_bundles
from app.clients.sistema_a import sistema_a_client
from app.clients.sistema_b import sistema_b_client


# =====================================================================
# Schemas
# =====================================================================
class PacienteEntrada(BaseModel):
    nome: str = Field(..., min_length=2)
    cartao_sus: str | None = Field(None, description="CNS — recomendado para de-dup posterior")
    cpf: str | None = None
    telefone: str | None = None
    email: str | None = None
    data_nascimento: str | None = Field(None, description="YYYY-MM-DD")
    sexo: str | None = Field(None, pattern="^[MFOmfo]$|^(masculino|feminino|outro|male|female|other)$")


class ProfissionalEntrada(BaseModel):
    nome: str = Field(..., min_length=2)
    crm: str = Field(..., min_length=1)
    crm_uf: str | None = Field(None, min_length=2, max_length=2, description="UF — sistema A separa em coluna; sistema B exige")
    especialidade: str | None = None
    telefone: str | None = None
    email: str | None = None


class AgendamentoEntrada(BaseModel):
    paciente_id: str | int
    profissional_id: str | int
    data_agendamento: str | None = Field(None, description="YYYY-MM-DD (sistema A)")
    hora_agendamento: str | None = Field(None, description="HH:MM (sistema A)")
    inicio: str | None = Field(None, description="ISO datetime (sistema B)")
    status: str | None = Field(None, description="agendado/booked/pending…")
    observacoes: str | None = None


# =====================================================================
# Helpers
# =====================================================================
DESTINOS = {"sistema_a", "sistema_b"}


def _destino_invalido():
    raise HTTPException(status_code=400, detail="X-Sistema-Destino deve ser sistema_a ou sistema_b")


def _erro_externo(destino: str, exc: Exception):
    raise HTTPException(status_code=502, detail=f"Falha ao escrever em {destino}: {exc}")


# =====================================================================
# Router
# =====================================================================
router = APIRouter(tags=["Escrita"])


# ---- Pacientes ----
@router.post("/pacientes", tags=["Pacientes"])
async def criar_paciente(
    p: PacienteEntrada,
    x_sistema_destino: str = Header(..., alias="X-Sistema-Destino"),
):
    if not (p.cartao_sus or p.cpf):
        raise HTTPException(status_code=422, detail={"erros": ["Forneça pelo menos CNS (cartao_sus) ou CPF."]})
    if x_sistema_destino not in DESTINOS:
        _destino_invalido()

    payload = p.model_dump(exclude_none=True)
    try:
        cliente = sistema_a_client if x_sistema_destino == "sistema_a" else sistema_b_client
        criado = await cliente.criar_paciente(payload)
    except HTTPException:
        raise
    except Exception as e:
        _erro_externo(x_sistema_destino, e)

    invalidar_cache_bundles(x_sistema_destino)  # type: ignore[arg-type]
    return {"destino": x_sistema_destino, "recurso": criado}


# ---- Profissionais ----
@router.post("/profissionais", tags=["Profissionais"])
async def criar_profissional(
    p: ProfissionalEntrada,
    x_sistema_destino: str = Header(..., alias="X-Sistema-Destino"),
):
    if x_sistema_destino not in DESTINOS:
        _destino_invalido()
    payload = p.model_dump(exclude_none=True)

    # Sistema B exige crm_uf; aviso amigável
    if x_sistema_destino == "sistema_b" and not p.crm_uf:
        raise HTTPException(status_code=422, detail={"erros": ["Sistema B requer crm_uf (sigla da UF, 2 letras)."]})

    try:
        cliente = sistema_a_client if x_sistema_destino == "sistema_a" else sistema_b_client
        criado = await cliente.criar_profissional(payload)
    except HTTPException:
        raise
    except Exception as e:
        _erro_externo(x_sistema_destino, e)

    invalidar_cache_bundles(x_sistema_destino)  # type: ignore[arg-type]
    return {"destino": x_sistema_destino, "recurso": criado}


# ---- Agendamentos ----
@router.post("/agendamentos", tags=["Agendamentos"])
async def criar_agendamento(
    a: AgendamentoEntrada,
    x_sistema_destino: str = Header(..., alias="X-Sistema-Destino"),
):
    if x_sistema_destino not in DESTINOS:
        _destino_invalido()

    # Sistema A usa data_agendamento+hora_agendamento; B usa inicio (ISO)
    if x_sistema_destino == "sistema_a" and not (a.data_agendamento and a.hora_agendamento):
        raise HTTPException(status_code=422, detail={"erros": ["Sistema A requer data_agendamento e hora_agendamento."]})
    if x_sistema_destino == "sistema_b" and not a.inicio:
        raise HTTPException(status_code=422, detail={"erros": ["Sistema B requer 'inicio' (ISO datetime)."]})

    payload = a.model_dump(exclude_none=True)
    try:
        cliente = sistema_a_client if x_sistema_destino == "sistema_a" else sistema_b_client
        criado = await cliente.criar_agendamento(payload)
    except HTTPException:
        raise
    except Exception as e:
        _erro_externo(x_sistema_destino, e)

    invalidar_cache_bundles(x_sistema_destino)  # type: ignore[arg-type]
    return {"destino": x_sistema_destino, "recurso": criado}


# ---- Cache control ----
@router.post("/cache/invalidar", tags=["Cache"])
def invalidar_cache(origem: str | None = None):
    """Invalida o cache de Bundles. Útil quando algo foi escrito direto em A/B."""
    if origem and origem not in DESTINOS and origem != "ambos":
        _destino_invalido()
    n = invalidar_cache_bundles(origem)  # type: ignore[arg-type]
    return {"invalidado": n, "origem": origem or "ambos"}
