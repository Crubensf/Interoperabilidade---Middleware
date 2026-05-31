from typing import Any

import httpx

from app.clients.retry import com_retry
from app.config import settings


class SistemaAClient:
    """Cliente para o Sistema A (Node/Express + Supabase). Sem autenticação."""

    def __init__(self) -> None:
        self.base_url = settings.SISTEMA_A_BASE_URL.rstrip("/")
        self.timeout = settings.HTTP_TIMEOUT

    def _headers(self) -> dict[str, str]:
        h: dict[str, str] = {}
        if settings.SISTEMA_A_API_KEY:
            h["X-API-Key"] = settings.SISTEMA_A_API_KEY
        return h

    async def _get(self, path: str) -> Any:
        async def _do():
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}{path}", headers=self._headers())
                resp.raise_for_status()
                return resp.json()
        return await com_retry(_do, rotulo=f"A GET {path}")

    async def _post(self, path: str, payload: dict) -> Any:
        # POST sem retry — operação não-idempotente
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}{path}", json=payload, headers=self._headers())
            resp.raise_for_status()
            return resp.json()

    async def criar_paciente(self, payload: dict) -> dict:
        return await self._post("/pacientes", payload)

    async def criar_profissional(self, payload: dict) -> dict:
        return await self._post("/profissionais", payload)

    async def criar_agendamento(self, payload: dict) -> dict:
        return await self._post("/agendamentos", payload)

    async def listar_pacientes(self) -> list[dict]:
        return await self._get("/pacientes")

    async def listar_profissionais(self) -> list[dict]:
        return await self._get("/profissionais")

    async def listar_agendamentos(self) -> list[dict]:
        return await self._get("/agendamentos")

    async def bundle_fhir(self) -> dict:
        # Retorna Bundle FHIR R4 com Patient/Practitioner/Location/Appointment
        return await self._get("/fhir/bundle")

    async def health(self) -> bool:
        try:
            await self._get("/health")
            return True
        except Exception:
            return False


sistema_a_client = SistemaAClient()
