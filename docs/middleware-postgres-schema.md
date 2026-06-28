# Middleware Postgres Schema

## Objetivo

Este schema substitui o uso atual de SQLite no middleware por um modelo
persistente em Postgres, preparado para:

- autenticacao por API key
- ingestao idempotente de eventos FHIR
- armazenamento do ultimo snapshot de cada recurso externo
- projecoes de leitura locais
- continuidade das funcoes atuais de audit e MPI

## Blocos do banco

### 1. Core operacional

- `schema_migrations`: controle simples das migrations SQL aplicadas.
- `api_keys`: credenciais de produtores do middleware.
- `audit_log`: auditoria HTTP e operacional.
- `ingestion_events`: log imutavel de eventos recebidos.
- `resource_store`: ultimo estado conhecido de cada recurso externo.

### 2. Projecoes de leitura

- `patient_projection`
- `practitioner_projection`
- `location_projection`
- `appointment_projection`

### 3. Projecoes de identidade

- `patient_identity_projection`
- `practitioner_identity_projection`

Essas tabelas preservam o papel do MPI atual, mas em Postgres.

## Relacoes principais

- `api_keys.id` e referenciado por `audit_log.api_key_id` e
  `ingestion_events.api_key_id`.
- `resource_store.id` e referenciado por `ingestion_events.resource_store_id`.
- cada tabela de projecao usa `resource_store_id` como chave primaria e
  referencia `resource_store(id)`.

## Regras de modelagem

- `ingestion_events` guarda historico imutavel do que entrou.
- `resource_store` guarda o ultimo snapshot consolidado do recurso.
- as projecoes de leitura sao derivadas de `resource_store`.
- a identidade externa canonica e o trio:
  `source_system + resource_type + source_resource_id`.
- deduplicacao de retries acontece por:
  `source_system + idempotency_key`.
- rastreio de evento de origem acontece por:
  `source_system + event_id`.

## Decisoes

- migrations em SQL puro, sem ORM nesta fase
- JSONB para payload bruto e recurso canonico
- indices especificos por identificadores de negocio
- projecoes separadas por recurso para simplificar leitura e filtros

## Arquivos desta task

- `Middleware/migrations/0001_postgres_foundation.sql`
- `Middleware/migrations/0002_postgres_core_tables.sql`
- `Middleware/migrations/0003_postgres_read_projections.sql`
- `Middleware/migrations/README.md`
