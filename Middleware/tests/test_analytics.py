"""Cobertura das funções puras de analytics sobre agendamentos."""

from datetime import datetime, timezone

from app import analytics


def _ag(**kw):
    base = {
        "id": "x",
        "origem": "sistema_a",
        "status": "booked",
        "inicio": None,
        "fim": None,
        "tipo": None,
        "descricao": None,
        "paciente": None,
        "profissional": None,
        "local": None,
    }
    base.update(kw)
    return base


def test_distribuicao_status_calcula_taxas_clinicas():
    ags = [
        _ag(status="booked"),
        _ag(status="booked"),
        _ag(status="fulfilled"),
        _ag(status="fulfilled"),
        _ag(status="cancelled"),
        _ag(status="noshow"),
    ]
    out = analytics.distribuicao_por_status(ags)
    assert out["total"] == 6
    # 2 fulfilled (realizado), 1 cancelled, 1 noshow, 2 booked (não conta em nenhum)
    assert out["taxa_realizado_pct"] == round(2 / 6 * 100, 1)
    assert out["taxa_cancelamento_pct"] == round(1 / 6 * 100, 1)
    assert out["taxa_noshow_pct"] == round(1 / 6 * 100, 1)
    # items vem ordenado por freq desc; booked e fulfilled têm 2 cada
    contagens = {it["status"]: it["total"] for it in out["items"]}
    assert contagens["booked"] == 2
    assert contagens["fulfilled"] == 2
    assert contagens["cancelled"] == 1
    assert contagens["noshow"] == 1


def test_distribuicao_status_lista_vazia():
    out = analytics.distribuicao_por_status([])
    assert out["total"] == 0
    assert out["taxa_realizado_pct"] == 0.0
    assert out["taxa_noshow_pct"] == 0.0
    assert out["items"] == []


def test_top_profissionais_agrupa_e_quebra_por_status():
    ags = [
        _ag(profissional="Dra. Ana", status="fulfilled"),
        _ag(profissional="Dra. Ana", status="fulfilled"),
        _ag(profissional="Dra. Ana", status="cancelled"),
        _ag(profissional="Dr. Beto", status="noshow"),
        _ag(profissional=None, status="booked"),
    ]
    out = analytics.top_profissionais(ags, limite=10)
    nomes = [item["rotulo"] for item in out]
    assert nomes[0] == "Dra. Ana"
    ana = next(it for it in out if it["rotulo"] == "Dra. Ana")
    assert ana["total"] == 3
    assert ana["realizados"] == 2
    assert ana["cancelados"] == 1
    assert ana["noshow"] == 0
    # profissional None vira "(sem informação)"
    assert "(sem informação)" in nomes


def test_top_respeita_limite():
    ags = [_ag(profissional=f"P{i}") for i in range(15)]
    out = analytics.top_profissionais(ags, limite=5)
    assert len(out) == 5


def test_distribuicao_dia_semana_sempre_7_buckets():
    # Segunda 2026-06-22 às 10h, terça 23 às 10h, terça 23 às 11h
    ags = [
        _ag(inicio="2026-06-22T10:00:00Z"),
        _ag(inicio="2026-06-23T10:00:00Z"),
        _ag(inicio="2026-06-23T11:00:00Z"),
        _ag(inicio=None),  # ignorado
        _ag(inicio="lixo"),  # ignorado
    ]
    out = analytics.distribuicao_dia_semana(ags)
    assert len(out) == 7
    por_dia = {it["dia"]: it["total"] for it in out}
    assert por_dia["Seg"] == 1
    assert por_dia["Ter"] == 2
    assert por_dia["Qua"] == 0
    assert por_dia["Dom"] == 0


def test_distribuicao_hora_dia_sempre_24_buckets():
    ags = [
        _ag(inicio="2026-06-22T08:30:00Z"),
        _ag(inicio="2026-06-22T08:45:00Z"),
        _ag(inicio="2026-06-22T14:00:00Z"),
    ]
    out = analytics.distribuicao_hora_dia(ags)
    assert len(out) == 24
    por_hora = {it["hora"]: it["total"] for it in out}
    assert por_hora[8] == 2
    assert por_hora[14] == 1
    assert por_hora[0] == 0


def test_tendencia_30d_preenche_dias_vazios():
    hoje = datetime(2026, 6, 28, 12, 0, tzinfo=timezone.utc)
    ags = [
        _ag(inicio="2026-06-28T08:00:00Z"),
        _ag(inicio="2026-06-28T09:00:00Z"),
        _ag(inicio="2026-06-25T10:00:00Z"),
        _ag(inicio="2026-05-01T10:00:00Z"),  # fora da janela
    ]
    out = analytics.tendencia_diaria(ags, dias=30, hoje=hoje)
    assert len(out) == 30
    por_data = {it["data"]: it["total"] for it in out}
    assert por_data["2026-06-28"] == 2
    assert por_data["2026-06-25"] == 1
    assert por_data["2026-06-26"] == 0
    assert "2026-05-30" in por_data  # janela vai até 30 dias atrás
    assert "2026-05-01" not in por_data


def test_agregar_tudo_retorna_payload_completo():
    ags = [
        _ag(profissional="Dra. Ana", status="fulfilled", inicio="2026-06-22T10:00:00Z"),
        _ag(profissional="Dr. Beto", status="cancelled", inicio="2026-06-23T11:00:00Z"),
    ]
    out = analytics.agregar_tudo(ags, limite_top=5)
    assert out["total"] == 2
    assert "status" in out
    assert "top_profissionais" in out
    assert "top_tipos" in out
    assert "top_locais" in out
    assert "por_dia_semana" in out
    assert "por_hora_dia" in out
    assert "tendencia_30d" in out
    assert len(out["por_dia_semana"]) == 7
    assert len(out["por_hora_dia"]) == 24
    assert len(out["tendencia_30d"]) == 30
