# Backfill e Reconciliacao

## Objetivo

Importar o snapshot legado dos Sistemas A e B pelo contrato canonico
`POST /fhir/Bundle`, preservar a origem, reconciliar CPF/CNS/CRM e comprovar a
igualdade dos IDs por tipo de recurso.

O processo e reexecutavel. Cada lote e ordenado e recebe `X-Event-Id` e
`Idempotency-Key` derivados do SHA-256 do conteudo. Um segundo envio do mesmo
snapshot retorna `replayed`; um recurso alterado atualiza a mesma chave
`source_system + resource_type + source_resource_id` no `resource_store`.

## Pre-requisitos

1. Aplicar as migrations do middleware e concluir as Tasks 9 e 11.
2. Publicar a versao atual do Sistema B, que preserva os IDs locais no Bundle.
3. Criar uma API key de ingestao para cada origem:

```bash
cd Middleware
python scripts/manage_api_keys.py create --name "Backfill Sistema A" --source-system sistema_a
python scripts/manage_api_keys.py create --name "Backfill Sistema B" --source-system sistema_b
```

4. Configurar no servico do middleware:

```dotenv
BACKFILL_TARGET_BASE_URL=https://middleware-fair.onrender.com
BACKFILL_SISTEMA_A_API_KEY=<chave criada para sistema_a>
BACKFILL_SISTEMA_B_API_KEY=<chave criada para sistema_b>
BACKFILL_BATCH_SIZE=100
```

As credenciais existentes `SISTEMA_B_EMAIL` e `SISTEMA_B_SENHA` continuam sendo
usadas para ler o Bundle protegido do Sistema B. `SISTEMA_A_API_KEY` e usada
somente se o endpoint de leitura do Sistema A exigir chave.

## Execucao

Primeiro, valide conectividade e veja a divergencia atual sem gravar:

```bash
cd Middleware
python scripts/backfill.py --source ambos --dry-run --allow-drift
```

Depois execute o backfill:

```bash
python scripts/backfill.py --source ambos --mark-stale --output backfill-report.json
```

`--mark-stale` deve ser usado somente depois de confirmar que os dois Bundles
sao snapshots completos. Ele marca como `deleted` os IDs ativos ausentes da
origem, inclusive UUIDs artificiais gerados por versoes antigas do Bundle do
Sistema B; nenhum registro de auditoria e apagado.

Repita o mesmo comando para testar idempotencia. Na segunda execucao, os lotes
inalterados devem aparecer em `replayed_batches`, sem aumento da quantidade de
recursos no middleware.

## Criterio de aceite

O comando retorna exit code `0` quando:

- nao existem `failed_resources`;
- `source`, `middleware` e `matched` coincidem para Patient, Practitioner,
  Location e Appointment de cada origem;
- `missing_ids` e `unexpected_ids` estao vazios;
- `unindexed_patients` e `unindexed_practitioners` sao zero.

Exit code `2` indica divergencia de dados. O relatorio lista os IDs faltantes ou
inesperados para investigacao; ele nao apaga registros automaticamente.
