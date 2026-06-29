"""Smoke tests para estatisticas_audit() — valida o shape do retorno
usando mocks que imitam a interface do psycopg cursor."""

from app.mpi import repository


class _FakeRow(dict):
    pass


class _FakeCursor:
    def __init__(self, row):
        self._row = row

    def fetchone(self):
        return self._row


class _FakeConn:
    def __init__(self, total_geral, agg_row):
        self._total_geral = total_geral
        self._agg_row = agg_row
        self.queries = []

    def execute(self, query, params=()):
        normalized = " ".join(query.split())
        self.queries.append((normalized, params))
        if "COUNT(*) AS n FROM audit_log" in normalized and "FILTER" not in normalized:
            return _FakeCursor(_FakeRow(n=self._total_geral))
        if "FILTER" in normalized:
            return _FakeCursor(self._agg_row)
        raise AssertionError(f"Query inesperada: {normalized}")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def test_estatisticas_audit_calcula_taxas_e_separa_5xx(monkeypatch):
    agg = _FakeRow(
        total=200,
        erros_servidor=4,
        rejeicoes_cliente=10,
        nao_autorizado=8,
        duracao_media=42.7,
        ultimo_hora=50,
        erros_servidor_hora=2,
    )
    fake_conn = _FakeConn(total_geral=500, agg_row=agg)
    monkeypatch.setattr(repository, "conn", lambda: fake_conn)

    out = repository.estatisticas_audit()

    assert out["total"] == 200
    assert out["total_geral_inclui_health"] == 500
    assert out["erros_servidor"] == 4
    assert out["rejeicoes_cliente"] == 10
    assert out["nao_autorizado"] == 8
    assert out["taxa_erro_servidor_pct"] == 2.0  # 4 / 200
    assert out["taxa_rejeicao_cliente_pct"] == 5.0  # 10 / 200
    assert out["duracao_media_ms"] == 42.7
    assert out["janela_1h"]["requisicoes"] == 50
    assert out["janela_1h"]["erros_servidor"] == 2
    assert out["janela_1h"]["taxa_erro_pct"] == 4.0
    # legado: 'erros' agora reflete apenas server errors, não 4xx+5xx
    assert out["erros"] == 4

    # Confirma que o filtro de noise vai no segundo SQL
    second_sql = fake_conn.queries[1][0]
    assert "path <> ALL(%s)" in second_sql
    noise_param = fake_conn.queries[1][1][0]
    assert "/health" in noise_param
    assert "/ready" in noise_param
    assert "/favicon.ico" in noise_param


def test_estatisticas_audit_evita_divisao_por_zero(monkeypatch):
    agg = _FakeRow(
        total=0,
        erros_servidor=0,
        rejeicoes_cliente=0,
        nao_autorizado=0,
        duracao_media=None,
        ultimo_hora=0,
        erros_servidor_hora=0,
    )
    fake_conn = _FakeConn(total_geral=0, agg_row=agg)
    monkeypatch.setattr(repository, "conn", lambda: fake_conn)

    out = repository.estatisticas_audit()

    assert out["taxa_erro_servidor_pct"] == 0.0
    assert out["taxa_rejeicao_cliente_pct"] == 0.0
    assert out["janela_1h"]["taxa_erro_pct"] == 0.0
    assert out["duracao_media_ms"] == 0
