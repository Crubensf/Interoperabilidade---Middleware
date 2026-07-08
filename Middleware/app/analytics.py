"""Agregadores analíticos sobre agendamentos consolidados.

Funções puras: recebem listas de summaries (saída de resumir_agendamento) e
devolvem dicts com agregações prontas pro dashboard. Sem I/O, sem DB.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Iterable


# Status FHIR Appointment que consideramos como "consulta efetivamente realizada".
_STATUS_REALIZADO = {"fulfilled", "arrived", "checked-in"}
_STATUS_CANCELADO = {"cancelled", "entered-in-error"}
_STATUS_NOSHOW = {"noshow"}


# 0 = segunda-feira (ISO). Mantemos rótulos curtos pro chart.
_DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]


def _parse_inicio(valor: str | None) -> datetime | None:
    """Aceita ISO 8601 com ou sem timezone; converte 'Z' -> '+00:00'."""
    if not valor or not isinstance(valor, str):
        return None
    raw = valor.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


def _normalizar_label(valor: str | None) -> str:
    if not valor:
        return "(sem informação)"
    s = str(valor).strip()
    return s.title() if s else "(sem informação)"


def _pct(numer: int, denom: int) -> float:
    return round((numer / denom) * 100, 1) if denom else 0.0


def distribuicao_por_status(agendamentos: Iterable[dict]) -> dict:
    counts: Counter[str] = Counter()
    total = 0
    for ag in agendamentos:
        total += 1
        status = (ag.get("status") or "indefinido").lower()
        counts[status] += 1

    realizados = sum(counts[s] for s in _STATUS_REALIZADO)
    cancelados = sum(counts[s] for s in _STATUS_CANCELADO)
    noshow = sum(counts[s] for s in _STATUS_NOSHOW)

    items = [
        {"status": status, "total": qtd, "pct": _pct(qtd, total)}
        for status, qtd in sorted(counts.items(), key=lambda x: -x[1])
    ]

    return {
        "total": total,
        "items": items,
        "taxa_realizado_pct": _pct(realizados, total),
        "taxa_cancelamento_pct": _pct(cancelados, total),
        "taxa_noshow_pct": _pct(noshow, total),
    }


def _top_por_chave(agendamentos: Iterable[dict], chave: str, limite: int) -> list[dict]:
    contagem: Counter[str] = Counter()
    por_status: dict[str, Counter[str]] = defaultdict(Counter)
    for ag in agendamentos:
        rotulo = _normalizar_label(ag.get(chave))
        contagem[rotulo] += 1
        por_status[rotulo][(ag.get("status") or "indefinido").lower()] += 1

    top = contagem.most_common(limite)
    return [
        {
            "rotulo": rotulo,
            "total": qtd,
            "realizados": sum(por_status[rotulo][s] for s in _STATUS_REALIZADO),
            "cancelados": sum(por_status[rotulo][s] for s in _STATUS_CANCELADO),
            "noshow": sum(por_status[rotulo][s] for s in _STATUS_NOSHOW),
        }
        for rotulo, qtd in top
    ]


def top_profissionais(agendamentos: Iterable[dict], limite: int = 10) -> list[dict]:
    return _top_por_chave(agendamentos, "profissional", limite)


def top_tipos(agendamentos: Iterable[dict], limite: int = 10) -> list[dict]:
    return _top_por_chave(agendamentos, "tipo", limite)


def top_locais(agendamentos: Iterable[dict], limite: int = 10) -> list[dict]:
    return _top_por_chave(agendamentos, "local", limite)


def distribuicao_dia_semana(agendamentos: Iterable[dict]) -> list[dict]:
    """Retorna 7 buckets (segunda=0..domingo=6) com counts. Sempre todos os dias."""
    counts = [0] * 7
    for ag in agendamentos:
        dt = _parse_inicio(ag.get("inicio"))
        if dt is None:
            continue
        counts[dt.weekday()] += 1
    return [
        {"dia": _DIAS_SEMANA[i], "total": counts[i]}
        for i in range(7)
    ]


def distribuicao_hora_dia(agendamentos: Iterable[dict]) -> list[dict]:
    """Retorna 24 buckets (0..23h) com counts. Sempre todas as horas."""
    counts = [0] * 24
    for ag in agendamentos:
        dt = _parse_inicio(ag.get("inicio"))
        if dt is None:
            continue
        counts[dt.hour] += 1
    return [{"hora": h, "total": counts[h]} for h in range(24)]


def tendencia_diaria(
    agendamentos: Iterable[dict],
    *,
    dias: int = 30,
    hoje: datetime | None = None,
) -> list[dict]:
    """Série temporal contínua: últimos N dias, mesmo que vazios.

    Aceita `hoje` para o teste fixar a janela; default = NOW UTC.
    """
    base = hoje or datetime.now(timezone.utc)
    base_date = base.date()
    janela_inicio = base_date - timedelta(days=dias - 1)

    por_dia: Counter[str] = Counter()
    for ag in agendamentos:
        dt = _parse_inicio(ag.get("inicio"))
        if dt is None:
            continue
        d = dt.date()
        if d < janela_inicio or d > base_date:
            continue
        por_dia[d.isoformat()] += 1

    return [
        {
            "data": (janela_inicio + timedelta(days=i)).isoformat(),
            "total": por_dia.get((janela_inicio + timedelta(days=i)).isoformat(), 0),
        }
        for i in range(dias)
    ]


def agregar_tudo(agendamentos: list[dict], *, limite_top: int = 10) -> dict:
    """Atalho que monta o payload completo do endpoint /estatisticas/agendamentos."""
    return {
        "total": len(agendamentos),
        "status": distribuicao_por_status(agendamentos),
        "top_profissionais": top_profissionais(agendamentos, limite=limite_top),
        "top_tipos": top_tipos(agendamentos, limite=limite_top),
        "top_locais": top_locais(agendamentos, limite=limite_top),
        "por_dia_semana": distribuicao_dia_semana(agendamentos),
        "por_hora_dia": distribuicao_hora_dia(agendamentos),
        "tendencia_30d": tendencia_diaria(agendamentos, dias=30),
    }
