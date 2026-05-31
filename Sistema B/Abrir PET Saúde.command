#!/usr/bin/env bash
# ──────────────────────────────────────────────
#  PET Saúde — Iniciador (duplo clique para abrir)
# ──────────────────────────────────────────────

# Navega para a pasta do projeto (independente de onde o arquivo está)
cd "$(dirname "$0")"

# Abre o browser assim que o frontend responder (roda em paralelo)
(
  for i in $(seq 1 60); do
    sleep 0.5
    curl -sf http://localhost:5173 &>/dev/null && break
  done
  open "http://localhost:5173"
) &

# Inicia o sistema completo (PostgreSQL → backend → frontend)
./start.sh
