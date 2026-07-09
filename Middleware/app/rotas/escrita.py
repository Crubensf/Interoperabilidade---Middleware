from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.agregador import invalidar_cache_bundles
from app.auth import require_api_key
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
    municipio: str | None = None
    endereco: str | None = None
    nome_mae: str | None = None


class ProfissionalEntrada(BaseModel):
    nome: str = Field(..., min_length=2)
    crm: str = Field(..., min_length=1)
    crm_uf: str | None = Field(None, min_length=2, max_length=2)
    especialidade: str | None = None
    telefone: str | None = None
    email: str | None = None
    tipo_atendimento: str | None = None


class AgendamentoEntrada(BaseModel):
    paciente_id: int
    profissional_id: int
    local_id: int
    data: str = Field(..., description="YYYY-MM-DD")
    hora: str = Field(..., description="HH:MM")
    status: str | None = Field(None, description="agendado, pending, etc")
    modalidade: str | None = None
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
router = APIRouter(
    tags=["Escrita"],
)


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
    
    if x_sistema_destino == "sistema_a":
        payload.pop("email", None)
        payload.pop("municipio", None)
        payload.pop("endereco", None)
        payload.pop("nome_mae", None)

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

    if x_sistema_destino == "sistema_a":
        # Sistema A não salva email
        payload.pop("email", None)
    elif x_sistema_destino == "sistema_b":
        if not p.crm_uf:
            raise HTTPException(status_code=422, detail={"erros": ["Sistema B requer crm_uf (sigla da UF, 2 letras)."]})
        # Sistema B não salva tipo_atendimento
        payload.pop("tipo_atendimento", None)

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

    payload = a.model_dump(exclude_none=True)

    if x_sistema_destino == "sistema_a":
        payload["data_agendamento"] = payload.pop("data")
        payload["hora_agendamento"] = payload.pop("hora")
        payload.pop("modalidade", None)
    elif x_sistema_destino == "sistema_b":
        payload["inicio"] = f"{payload.pop('data')}T{payload.pop('hora')}:00"

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
