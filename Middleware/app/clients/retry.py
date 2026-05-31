"""Retry com backoff exponencial para chamadas HTTP transientes.

Sem dependência externa (tenacity) para manter o requirements enxuto.
Tenta 3x por padrão em: HTTPStatusError 5xx, TimeoutException, ConnectError.
"""
import asyncio
import logging
import random
from typing import Awaitable, Callable, TypeVar

import httpx

logger = logging.getLogger(__name__)

T = TypeVar("T")

_RETRYABLE_STATUS = {500, 502, 503, 504}


def _is_retryable(exc: BaseException) -> bool:
    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError)):
        return True
    if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code in _RETRYABLE_STATUS:
        return True
    return False


async def com_retry(
    func: Callable[[], Awaitable[T]],
    *,
    tentativas: int = 3,
    base_delay: float = 0.3,
    max_delay: float = 3.0,
    rotulo: str = "http",
) -> T:
    """Executa func com retry exponencial + jitter em falhas transientes."""
    ultima_exc: BaseException | None = None
    for i in range(1, tentativas + 1):
        try:
            return await func()
        except BaseException as exc:
            ultima_exc = exc
            if not _is_retryable(exc) or i == tentativas:
                raise
            delay = min(max_delay, base_delay * (2 ** (i - 1)))
            delay += random.uniform(0, delay * 0.25)
            logger.warning(
                "[%s] tentativa %d/%d falhou (%s); retry em %.2fs",
                rotulo, i, tentativas, type(exc).__name__, delay,
            )
            await asyncio.sleep(delay)
    # inalcançável, mas mantém type-checker feliz
    raise ultima_exc  # type: ignore[misc]
