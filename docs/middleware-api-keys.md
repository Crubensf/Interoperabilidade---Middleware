# Middleware API Keys

## Objetivo

O middleware autentica produtores por `X-API-Key`. Cada chave pertence a um
`source_system` e pode coexistir com outras para permitir rotacao sem janela de
indisponibilidade.

## Fluxo de rotacao basica

1. criar uma nova chave para o mesmo produtor
2. configurar o produtor para usar a nova chave
3. validar trafego no middleware
4. desativar a chave antiga

## Script operacional

O projeto inclui o script:

- `Middleware/scripts/manage_api_keys.py`

### Criar chave

```bash
cd Middleware
./.venv/bin/python scripts/manage_api_keys.py create \
  --name "Sistema A Prod" \
  --source-system sistema_a
```

### Listar chaves

```bash
cd Middleware
./.venv/bin/python scripts/manage_api_keys.py list
```

### Rotacionar chave

```bash
cd Middleware
./.venv/bin/python scripts/manage_api_keys.py rotate --id <uuid-da-chave-antiga>
```

### Desativar chave antiga

```bash
cd Middleware
./.venv/bin/python scripts/manage_api_keys.py deactivate --id <uuid-da-chave-antiga>
```

## Formato da chave

As chaves geradas seguem o formato:

- `mwi.<source_system>.<prefixo>.<segredo>`

O middleware armazena apenas `key_prefix` e `key_hash`. A chave bruta so e
mostrada no momento da criacao/rotacao.
