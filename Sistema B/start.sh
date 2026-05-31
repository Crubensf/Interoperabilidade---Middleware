#!/usr/bin/env bash
# Inicia PostgreSQL, backend (FastAPI/Uvicorn) e frontend (Vite).
# Uso: ./start.sh
# Para encerrar: Ctrl+C (mata backend e frontend; PostgreSQL continua rodando)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# ── Cores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${BOLD}[start]${RESET} $*"; }
ok()   { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn() { echo -e "${YELLOW}[warn]${RESET}  $*"; }
err()  { echo -e "${RED}[erro]${RESET}  $*"; }

# ── Verificações básicas ─────────────────────────────────────────────────────
check_cmd() {
  command -v "$1" &>/dev/null || { err "Comando '$1' não encontrado."; exit 1; }
}
check_cmd python3
check_cmd npm

# ── PostgreSQL ───────────────────────────────────────────────────────────────
log "Verificando PostgreSQL…"

# Localiza pg_ctl e PGDATA automaticamente
PG_CTL=""
PGDATA=""
for candidate_bin in \
  /opt/homebrew/opt/postgresql@16/bin/pg_ctl \
  /opt/homebrew/opt/postgresql@15/bin/pg_ctl \
  /opt/homebrew/opt/postgresql@14/bin/pg_ctl \
  /opt/homebrew/opt/postgresql/bin/pg_ctl \
  /usr/local/opt/postgresql@14/bin/pg_ctl \
  /usr/local/opt/postgresql/bin/pg_ctl \
  $(command -v pg_ctl 2>/dev/null || true); do
  [ -x "$candidate_bin" ] && PG_CTL="$candidate_bin" && break
done

for candidate_data in \
  /opt/homebrew/var/postgresql@16 \
  /opt/homebrew/var/postgresql@15 \
  /opt/homebrew/var/postgresql@14 \
  /opt/homebrew/var/postgresql \
  /usr/local/var/postgresql@14 \
  /usr/local/var/postgresql; do
  [ -f "$candidate_data/PG_VERSION" ] && PGDATA="$candidate_data" && break
done

if [ -z "$PG_CTL" ] || [ -z "$PGDATA" ]; then
  err "Não foi possível encontrar pg_ctl ou o data directory do PostgreSQL."
  err "Instale com: brew install postgresql@14"
  exit 1
fi

PG_BIN="$(dirname "$PG_CTL")"

# Testa conexão TCP real (não o PID file, que pode estar obsoleto)
pg_running() {
  "$PG_BIN/pg_isready" -h localhost -p 5432 -q 2>/dev/null
}

if pg_running; then
  ok "PostgreSQL já está rodando."
else
  # Remove PID file obsoleto: verifica se o processo no PID é realmente o PostgreSQL
  PIDFILE="$PGDATA/postmaster.pid"
  if [ -f "$PIDFILE" ]; then
    OLD_PID=$(head -1 "$PIDFILE" 2>/dev/null || echo "")
    if [ -n "$OLD_PID" ]; then
      PROC_NAME=$(ps -p "$OLD_PID" -o comm= 2>/dev/null || echo "")
      if [ -z "$PROC_NAME" ] || ! echo "$PROC_NAME" | grep -qi "postgres"; then
        warn "Removendo PID file obsoleto (PID $OLD_PID é '$PROC_NAME', não PostgreSQL)…"
        rm -f "$PIDFILE"
      fi
    fi
  fi

  log "Iniciando PostgreSQL via pg_ctl (data: $PGDATA)…"
  "$PG_CTL" -D "$PGDATA" -l "$PGDATA/server.log" start 2>&1 | sed "s/^/  /" || true

  # Aguarda o PostgreSQL aceitar conexões TCP (até 15s)
  log "Aguardando PostgreSQL aceitar conexões…"
  for i in $(seq 1 30); do
    sleep 0.5
    pg_running && break
    if [ "$i" -eq 30 ]; then
      err "PostgreSQL não respondeu em 15s."
      err "Veja o log em: $PGDATA/server.log"
      exit 1
    fi
  done
  ok "PostgreSQL pronto."
fi

# ── Arquivo .env do backend ──────────────────────────────────────────────────
if [ ! -f "$BACKEND/.env" ]; then
  err "Arquivo $BACKEND/.env não encontrado."
  echo -e "  Crie com pelo menos:\n"
  echo -e "  DATABASE_URL=postgresql+psycopg://usuario@localhost:5432/pet_ubs"
  echo -e "  SECRET_KEY=<chave-forte>"
  exit 1
fi
ok ".env encontrado."

# ── Banco de dados ───────────────────────────────────────────────────────────
# Extrai nome do banco da DATABASE_URL e cria se não existir
DB_NAME=$(grep '^DATABASE_URL' "$BACKEND/.env" | sed 's|.*://[^/]*/||' | tr -d '[:space:]' | cut -d'?' -f1)
DB_USER=$(grep '^DATABASE_URL' "$BACKEND/.env" | sed 's|.*://||; s|[@:/].*||')

if [ -n "$DB_NAME" ] && [ -n "$DB_USER" ]; then
  if ! psql -U "$DB_USER" -lqt 2>/dev/null | cut -d\| -f1 | grep -qw "$DB_NAME"; then
    log "Banco '$DB_NAME' não existe. Criando…"
    createdb -U "$DB_USER" "$DB_NAME" 2>&1 | sed "s/^/  /" && ok "Banco '$DB_NAME' criado." || warn "Não foi possível criar o banco automaticamente."
  else
    ok "Banco '$DB_NAME' OK."
  fi
fi

# ── Dependências Python ──────────────────────────────────────────────────────
log "Verificando dependências Python…"
MISSING_PY=()
while IFS= read -r line; do
  pkg=$(echo "$line" | sed 's/[>=<![ ].*//' | tr '[:upper:]' '[:lower:]' | tr '-' '_')
  [ -z "$pkg" ] && continue
  python3 -c "import importlib; importlib.import_module('$pkg')" 2>/dev/null || MISSING_PY+=("$line")
done < <(grep -v '^#' "$BACKEND/requirements.txt" | grep -v '^$')

if [ ${#MISSING_PY[@]} -gt 0 ]; then
  warn "Pacotes Python ausentes: ${MISSING_PY[*]}"
  log "Instalando com pip…"
  python3 -m pip install -r "$BACKEND/requirements.txt" --quiet
  ok "Dependências Python instaladas."
else
  ok "Dependências Python OK."
fi

# ── Dependências Node ────────────────────────────────────────────────────────
log "Verificando dependências Node…"
if [ ! -d "$FRONTEND/node_modules" ]; then
  log "node_modules ausente. Rodando npm install…"
  npm install --prefix "$FRONTEND" --silent
  ok "Dependências Node instaladas."
else
  ok "node_modules OK."
fi

# ── Encerramento limpo ───────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  log "Encerrando backend e frontend…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null && wait "$pid" 2>/dev/null || true
  done
  ok "Encerrado. (PostgreSQL continua rodando em segundo plano)"
}
trap cleanup INT TERM EXIT

# ── Backend ──────────────────────────────────────────────────────────────────
log "Iniciando ${CYAN}backend${RESET} em http://127.0.0.1:8000 …"
(
  cd "$BACKEND"
  python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
) 2>&1 | sed "s/^/${CYAN}[backend]${RESET} /" &
PIDS+=($!)

# Aguarda o backend responder (até 15s)
log "Aguardando backend iniciar…"
for i in $(seq 1 30); do
  sleep 0.5
  curl -sf http://127.0.0.1:8000/ &>/dev/null && break
  if [ "$i" -eq 30 ]; then
    err "Backend não respondeu em 15s. Veja os logs acima."
    exit 1
  fi
done
ok "Backend pronto."

# ── Frontend ─────────────────────────────────────────────────────────────────
log "Iniciando ${CYAN}frontend${RESET} em http://localhost:5173 …"
(
  cd "$FRONTEND"
  npm run dev -- --host
) 2>&1 | sed "s/^/${CYAN}[frontend]${RESET} /" &
PIDS+=($!)

# ── Resumo ───────────────────────────────────────────────────────────────────
sleep 1
echo ""
echo -e "${BOLD}──────────────────────────────────────────${RESET}"
echo -e "  ${GREEN}${BOLD}PET Saúde — sistema iniciado${RESET}"
echo -e "  Frontend : ${CYAN}http://localhost:5173${RESET}"
echo -e "  Backend  : ${CYAN}http://127.0.0.1:8000${RESET}"
echo -e "  API Docs : ${CYAN}http://127.0.0.1:8000/docs${RESET}"
echo -e "${BOLD}──────────────────────────────────────────${RESET}"
echo -e "  Pressione ${BOLD}Ctrl+C${RESET} para encerrar."
echo ""

wait
