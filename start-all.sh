#!/usr/bin/env bash
# Sobe Sistema A, Sistema B e Middleware em background, na ordem correta.
# Uso: ./start-all.sh
# Encerrar: Ctrl+C (mata os 3 processos; PostgreSQL continua rodando)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SISTEMA_A="$ROOT/Sistema A/Pet_Saude"
SISTEMA_B="$ROOT/Sistema B"
MIDDLEWARE="$ROOT/Middleware"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${BOLD}[start-all]${RESET} $*"; }
ok()   { echo -e "${GREEN}[ok]${RESET}        $*"; }
warn() { echo -e "${YELLOW}[warn]${RESET}      $*"; }
err()  { echo -e "${RED}[erro]${RESET}      $*"; }

# ── Encerramento limpo ───────────────────────────────────────────────────────
PIDS=()
cleanup() {
  echo ""
  log "Encerrando serviços…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  ok "Encerrado. (PostgreSQL continua rodando)"
}
trap cleanup INT TERM EXIT

# ── Espera URL responder ─────────────────────────────────────────────────────
wait_for_url() {
  local url="$1"
  local nome="$2"
  local tentativas="${3:-30}"
  for i in $(seq 1 "$tentativas"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      ok "$nome pronto."
      return 0
    fi
    sleep 0.5
  done
  err "$nome não respondeu em $(awk "BEGIN{print $tentativas*0.5}")s ($url)."
  return 1
}

# ── 1) Sistema A (backend + frontend) ────────────────────────────────────────
log "Iniciando ${CYAN}Sistema A — backend${RESET} em http://localhost:5050 …"
(
  cd "$SISTEMA_A/backend"
  [ -d node_modules ] || { log "Instalando deps do Sistema A backend…"; npm install --silent; }
  # `start` (= node index.js) é mais portável que `dev` (depende do nodemon
  # estar no PATH e instalado).
  npm start
) 2>&1 | sed "s/^/${CYAN}[A-back]${RESET} /" &
PIDS+=($!)
wait_for_url "http://localhost:5050/health" "Sistema A backend"

log "Iniciando ${CYAN}Sistema A — frontend${RESET} em http://localhost:5173 …"
(
  cd "$SISTEMA_A/frontend"
  [ -d node_modules ] || { log "Instalando deps do Sistema A frontend…"; npm install --silent; }
  npm run dev -- --host
) 2>&1 | sed "s/^/${CYAN}[A-front]${RESET} /" &
PIDS+=($!)

# ── 2) Sistema B ─────────────────────────────────────────────────────────────
log "Iniciando ${MAGENTA}Sistema B${RESET} em http://127.0.0.1:8000 …"
(
  cd "$SISTEMA_B"
  ./start.sh
) 2>&1 | sed "s/^/${MAGENTA}[sistema-b]${RESET} /" &
PIDS+=($!)
wait_for_url "http://127.0.0.1:8000/" "Sistema B" 60

# ── 3) Middleware ────────────────────────────────────────────────────────────
log "Iniciando ${BOLD}Middleware${RESET} em http://127.0.0.1:8080 …"
(
  cd "$MIDDLEWARE"
  ./start.sh
) 2>&1 | sed "s/^/${BOLD}[middleware]${RESET} /" &
PIDS+=($!)
wait_for_url "http://127.0.0.1:8080/health" "Middleware"

# ── Resumo ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}──────────────────────────────────────────${RESET}"
echo -e "  ${GREEN}${BOLD}3 sistemas no ar${RESET}"
echo -e "  Sistema A : ${CYAN}http://localhost:5173${RESET} (front) / ${CYAN}:5050${RESET} (back)"
echo -e "  Sistema B : ${MAGENTA}http://localhost:5174${RESET} (front) / ${MAGENTA}:8000${RESET} (back)"
echo -e "  Middleware: ${BOLD}http://127.0.0.1:8080${RESET} — dashboard em /dashboard"
echo -e "${BOLD}──────────────────────────────────────────${RESET}"
echo -e "  Ctrl+C para encerrar os 3."
echo ""

wait
