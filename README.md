# Interoperabilidade - Middleware FHIR

Projeto que conecta dois sistemas de gestão médica através de um middleware FHIR.

- **Sistema A** - Pet_Saude (Node + React + mock JSON / Supabase)
- **Sistema B** - PET Saúde UBS (Python + React + PostgreSQL)
- **Middleware** - FastAPI que traduz entre os dois

## Antes de começar

Você precisa de:

- Node.js 18+ - https://nodejs.org/
- Python 3.10+ - https://www.python.org/downloads/ (no Windows, marque "Add Python to PATH")
- PostgreSQL 14+ - https://www.postgresql.org/download/ (só pro Sistema B)

## Setup

Clone o repo:

```
git clone https://github.com/Crubensf/Interoperabilidade---Middleware.git
cd Interoperabilidade---Middleware
```

Copie os `.env.example` pra `.env` em cada subpasta e preencha:

- `Sistema A/Pet_Saude/backend/.env`
- `Sistema A/Pet_Saude/frontend/.env`
- `Sistema B/backend/.env`
- `Sistema B/frontend/.env`
- `Middleware/.env`

Pro Sistema B, crie o banco no PostgreSQL:

```
createdb pet_ubs
```

> O usuário admin do Sistema B é criado automaticamente no primeiro boot a partir
> das variáveis `ADMIN_EMAIL` / `ADMIN_SENHA` do `.env`. O middleware usa essas
> mesmas credenciais (definidas em `Middleware/.env`) para autenticar nos
> endpoints `/fhir`. Mantenha os dois lados em sincronia.

## Como rodar

**Tudo de uma vez:**

- Mac/Linux: `./start-all.sh` na raiz do projeto
- Windows: duplo-clique em `start-all.bat`

Esses scripts sobem Sistema A (back+front), Sistema B (via seu próprio `start.sh`)
e Middleware na ordem certa, esperando cada um responder antes do próximo. No
Mac/Linux, `Ctrl+C` encerra os três.

**Individualmente (Mac/Linux):**

```
# Sistema A
cd "Sistema A/Pet_Saude/backend" && npm install && npm start
cd "Sistema A/Pet_Saude/frontend" && npm install && npm run dev

# Sistema B
cd "Sistema B" && ./start.sh

# Middleware
cd Middleware && ./start.sh
```

**Individualmente (Windows):** duplo-clique no `Iniciar.bat` de cada projeto.

### Dados de demonstração

O Sistema A vem com `mock_db.json` vazio. Para popular com pacientes,
profissionais e um agendamento de exemplo:

```
cd "Sistema A/Pet_Saude/backend" && npm run seed
```

O Sistema B faz o seed (especialidades, locais, profissionais e usuário admin)
automaticamente no primeiro boot.

### Testes

```
cd Middleware && python3 -m pytest tests/ -v
```

## URLs

- Sistema A: http://localhost:5173 (front) / http://localhost:5050 (back)
- Sistema B: http://localhost:5174 (front) / http://127.0.0.1:8000 (back)
- Middleware: http://127.0.0.1:8080

## Notas de ambiente (macOS / Postgres)

- **Porta 5000 reservada pelo macOS.** Nas versões recentes do macOS, o AirPlay
  Receiver (Control Center) usa a porta 5000, o que causava `EADDRINUSE` no
  Sistema A. Por isso o backend do Sistema A usa **5050** por padrão. Se preferir
  manter 5000, desative o AirPlay Receiver em *Ajustes do Sistema → Geral →
  AirDrop e Handoff*.
- **PostgreSQL com lock file obsoleto.** Se o `pg_ctl` reclamar de
  `postmaster.pid` ao tentar subir o Postgres (após reboot), o
  `Sistema B/start.sh` já trata isso. Quando subir o backend isoladamente,
  remova manualmente: `rm /opt/homebrew/var/postgresql@14/postmaster.pid` e
  reinicie o serviço.
- **Frontends em portas diferentes.** Sistema A continua em 5173 e Sistema B
  passou para 5174 (configurado em `Sistema B/frontend/vite.config.js`).
