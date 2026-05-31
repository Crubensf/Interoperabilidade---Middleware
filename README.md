# Interoperabilidade - Middleware FHIR

Projeto que conecta dois sistemas de gestão médica através de um middleware FHIR.

- **Sistema A** - Pet_Saude (Node + React + Supabase)
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

Pro Sistema B, crie o banco no PostgreSQL e ajuste o `DATABASE_URL`:

```
createdb pet_ubs
```

## Como rodar

**Windows:** duplo-clique no `Iniciar.bat` de cada projeto.

**Mac/Linux:**

```
# Sistema A
cd "Sistema A/Pet_Saude/backend" && npm install && npm run dev
cd "Sistema A/Pet_Saude/frontend" && npm install && npm run dev

# Sistema B
cd "Sistema B" && ./start.sh

# Middleware
cd Middleware && ./start.sh
```

## URLs

- Sistema A: http://localhost:5173 (front) / http://localhost:5000 (back)
- Sistema B: http://localhost:5173 (front) / http://127.0.0.1:8000 (back)
- Middleware: http://127.0.0.1:8080

Os dois frontends usam a porta 5173, então rode um de cada vez (ou troque a porta de um no `vite.config.js`).
