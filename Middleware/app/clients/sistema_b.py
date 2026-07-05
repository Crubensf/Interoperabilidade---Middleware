import asyncio
from typing import Any

import httpx

from app.clients.retry import com_retry
from app.config import settings


class SistemaBClient:
    """Cliente para o Sistema B (FastAPI + SQLAlchemy). Endpoints /fhir exigem JWT."""

    def __init__(self) -> None:
        self.base_url = settings.SISTEMA_B_BASE_URL.rstrip("/")
        self.timeout = settings.HTTP_TIMEOUT
        self._token: str | None = None
        self._lock = asyncio.Lock()

    def _base_headers(self) -> dict[str, str]:
        h: dict[str, str] = {}
        if settings.SISTEMA_B_API_KEY:
            h["X-API-Key"] = settings.SISTEMA_B_API_KEY
        return h

    async def _login(self) -> str:
        payload = {"email": settings.SISTEMA_B_EMAIL, "senha": settings.SISTEMA_B_SENHA}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}/api/auth/login", json=payload, headers=self._base_headers())
            resp.raise_for_status()
            data = resp.json()
            token = data.get("access_token")
            if not token:
                raise RuntimeError("Login no Sistema B não retornou access_token.")
            return token

    async def _ensure_token(self) -> str:
        if self._token:
            return self._token
        async with self._lock:
            if not self._token:
                self._token = await self._login()
            return self._token

    async def _get(self, path: str, retry_on_401: bool = True) -> Any:
        async def _do():
            token = await self._ensure_token()
            headers = self._base_headers()
            headers["Authorization"] = f"Bearer {token}"
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}{path}", headers=headers)
                if resp.status_code == 401 and retry_on_401:
                    self._token = None
                    token2 = await self._ensure_token()
                    headers["Authorization"] = f"Bearer {token2}"
                    resp = await client.get(
                        f"{self.base_url}{path}",
                        headers=headers,
                    )
                resp.raise_for_status()
                return resp.json()
        return await com_retry(_do, rotulo=f"B GET {path}")

    async def bundle_fhir_geral(self) -> dict:
        return await self._get("/fhir/bundle/geral/transaction")

    async def _post(self, path: str, payload: dict, retry_on_401: bool = True) -> Any:
        token = await self._ensure_token()
        headers = self._base_headers()
        headers["Authorization"] = f"Bearer {token}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(f"{self.base_url}{path}", json=payload, headers=headers)
            if resp.status_code == 401 and retry_on_401:
                self._token = None
                return await self._post(path, payload, retry_on_401=False)
            resp.raise_for_status()
            return resp.json()

    async def criar_paciente(self, payload: dict) -> dict:
        return await self._post("/api/pacientes", payload)

    async def criar_profissional(self, payload: dict) -> dict:
        return await self._post("/api/profissionais", payload)

    async def criar_agendamento(self, payload: dict) -> dict:
        return await self._post("/api/agendamentos", payload)

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}/", headers=self._base_headers())
                resp.raise_for_status()
            return True
        except Exception:
            return False


sistema_b_client = SistemaBClient()
