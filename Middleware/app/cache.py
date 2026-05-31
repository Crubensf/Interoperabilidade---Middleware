"""Cache TTL in-memory, thread-safe via asyncio.Lock.

Não usa Redis pra manter o middleware single-binary. Para deploys multi-instância,
trocar por aiocache+Redis depois.
"""
import asyncio
import time
from typing import Any, Awaitable, Callable


class TTLCache:
    def __init__(self, default_ttl: float = 30.0):
        self.default_ttl = default_ttl
        self._store: dict[str, tuple[float, Any]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()

    def _get_lock(self, key: str) -> asyncio.Lock:
        lock = self._locks.get(key)
        if lock is None:
            lock = asyncio.Lock()
            self._locks[key] = lock
        return lock

    async def get_or_set(
        self,
        key: str,
        loader: Callable[[], Awaitable[Any]],
        ttl: float | None = None,
    ) -> tuple[Any, bool]:
        """Retorna (valor, hit). hit=True se veio do cache."""
        now = time.monotonic()
        ttl = ttl if ttl is not None else self.default_ttl

        # fast path: hit válido
        entry = self._store.get(key)
        if entry and entry[0] > now:
            return entry[1], True

        # slow path: stampede protection por chave
        async with self._global_lock:
            lock = self._get_lock(key)
        async with lock:
            entry = self._store.get(key)
            if entry and entry[0] > time.monotonic():
                return entry[1], True
            valor = await loader()
            self._store[key] = (time.monotonic() + ttl, valor)
            return valor, False

    def invalidate(self, prefix: str | None = None) -> int:
        """Invalida tudo ou só chaves com prefixo. Retorna nº removidas."""
        if prefix is None:
            n = len(self._store)
            self._store.clear()
            return n
        chaves = [k for k in self._store if k.startswith(prefix)]
        for k in chaves:
            self._store.pop(k, None)
        return len(chaves)

    def stats(self) -> dict:
        now = time.monotonic()
        vivos = sum(1 for exp, _ in self._store.values() if exp > now)
        return {"total": len(self._store), "vivos": vivos, "expirados": len(self._store) - vivos}


# Instância global usada pelo agregador
bundle_cache = TTLCache(default_ttl=30.0)
