# Middleware SQL Migrations

Estas migrations foram escritas em SQL puro para manter a Task 2 desacoplada
de ORM ou framework de migration.

## Ordem

Aplicar em ordem lexicografica:

1. `0001_postgres_foundation.sql`
2. `0002_postgres_core_tables.sql`
3. `0003_postgres_read_projections.sql`

## Escopo desta fase

- schema base do Postgres
- tabelas core de ingestao
- tabelas de projecao de leitura
- projecoes de identidade que substituem o MPI atual

## Observacao

A automacao de execucao das migrations fica para a Task 3, quando o middleware
passar a usar Postgres em runtime.
