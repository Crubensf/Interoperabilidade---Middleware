import asyncio
from typing import Literal

from app.cache import bundle_cache
from app.clients.sistema_a import sistema_a_client
from app.clients.sistema_b import sistema_b_client
from app.fhir.normalizer import extrair_recursos


Origem = Literal["sistema_a", "sistema_b", "ambos"]


async def _coletar_de(nome: str) -> list[dict]:
    """Coleta entries de um sistema individual, com cache TTL por sistema."""
    async def loader():
        if nome == "sistema_a":
            bundle = await sistema_a_client.bundle_fhir()
        else:
            bundle = await sistema_b_client.bundle_fhir_geral()
        return extrair_recursos(bundle, origem=nome)

    entries, _hit = await bundle_cache.get_or_set(f"bundle:{nome}", loader)
    return entries


async def coletar_entries(origem: Origem = "ambos") -> list[dict]:
    """Coleta entries FHIR dos sistemas selecionados, com tag de origem.

    Usa cache TTL por sistema (default 30s). Falhas parciais são toleradas
    desde que pelo menos um sistema retorne dados.
    """
    fontes = []
    if origem in ("ambos", "sistema_a"):
        fontes.append("sistema_a")
    if origem in ("ambos", "sistema_b"):
        fontes.append("sistema_b")

    resultados = await asyncio.gather(
        *(_coletar_de(f) for f in fontes), return_exceptions=True
    )

    entries: list[dict] = []
    erros: list[str] = []
    for nome, resultado in zip(fontes, resultados):
        if isinstance(resultado, Exception):
            erros.append(f"{nome}: {resultado}")
            continue
        entries.extend(resultado)

    if erros and not entries:
        raise RuntimeError("Falha ao obter dados dos sistemas: " + "; ".join(erros))

    return entries


def invalidar_cache_bundles(origem: Origem | None = None) -> int:
    """Invalida o cache. Útil após POST/PUT/DELETE."""
    if origem is None or origem == "ambos":
        return bundle_cache.invalidate("bundle:")
    return bundle_cache.invalidate(f"bundle:{origem}")
