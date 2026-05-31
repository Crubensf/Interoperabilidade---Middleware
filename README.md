# Interoperabilidade — Middleware FHIR

Projeto de interoperabilidade entre dois sistemas de gestão médica usando um **middleware FHIR**.

```
┌──────────────┐        ┌────────────────┐        ┌──────────────┐
│  Sistema A   │  <───> │   Middleware   │  <───> │  Sistema B   │
│  (MediCare)  │        │     (FHIR)     │        │ (PET Saúde)  │
└──────────────┘        └────────────────┘        └──────────────┘
  Node + React            Python FastAPI            Python + React
  Supabase                Porta 8080                PostgreSQL
  Porta 5000/5173                                   Porta 8000/5173
```

## 📦 Estrutura

| Pasta | Descrição | Stack |
|---|---|---|
| `Sistema A/Pet_Saude` | Sistema de gestão clínica MediCare | Node.js + React + Supabase |
| `Sistema B` | Sistema PET Saúde UBS | Python (FastAPI) + React + PostgreSQL |
| `Middleware` | Camada de tradução FHIR entre A e B | Python (FastAPI) |

---

## 🛠 Pré-requisitos

| Ferramenta | Versão | Onde baixar |
|---|---|---|
| **Node.js** | 18+ | <https://nodejs.org/> |
| **Python** | 3.10+ | <https://www.python.org/downloads/> *(marque "Add Python to PATH" no Windows)* |
| **PostgreSQL** | 14+ | <https://www.postgresql.org/download/> *(necessário só para o Sistema B)* |
| **Git** | qualquer | <https://git-scm.com/> |

---

## 🚀 Setup rápido

### 1. Clone o projeto

```bash
git clone <url-do-repo>
cd Interoperabilidade---Middleware
```

### 2. Configure as variáveis de ambiente

Em cada subprojeto, copie o `.env.example` para `.env` e preencha os valores:

```bash
# Sistema A
cp "Sistema A/Pet_Saude/backend/.env.example"  "Sistema A/Pet_Saude/backend/.env"
cp "Sistema A/Pet_Saude/frontend/.env.example" "Sistema A/Pet_Saude/frontend/.env"

# Sistema B
cp "Sistema B/backend/.env.example"  "Sistema B/backend/.env"
cp "Sistema B/frontend/.env.example" "Sistema B/frontend/.env"

# Middleware
cp "Middleware/.env.example" "Middleware/.env"
```

> No Windows (PowerShell): use `Copy-Item` em vez de `cp`.

### 3. Banco de dados (apenas Sistema B)

```bash
# Inicie o PostgreSQL e crie o banco
createdb pet_ubs

# Edite Sistema B/backend/.env e ajuste DATABASE_URL com seu usuário/senha
```

Gere uma `SECRET_KEY` nova para o Sistema B:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Rode cada sistema

#### 💻 Windows — basta dar duplo-clique em:
- `Sistema A/Pet_Saude/Iniciar.bat`
- `Sistema B/Iniciar.bat`
- `Middleware/Iniciar.bat`

Cada script instala dependências automaticamente na primeira execução.

#### 🍎 macOS / Linux

```bash
# Sistema A — backend
cd "Sistema A/Pet_Saude/backend" && npm install && npm run dev
# Em outro terminal — frontend
cd "Sistema A/Pet_Saude/frontend" && npm install && npm run dev

# Sistema B (já tem script pronto)
cd "Sistema B" && ./start.sh

# Middleware (já tem script pronto)
cd Middleware && ./start.sh
```

---

## 🌐 URLs

| Serviço | URL |
|---|---|
| Sistema A — Frontend | <http://localhost:5173> |
| Sistema A — Backend (API) | <http://localhost:5000> |
| Sistema B — Frontend | <http://localhost:5173> |
| Sistema B — Backend (API) | <http://127.0.0.1:8000> |
| Sistema B — Docs (Swagger) | <http://127.0.0.1:8000/docs> |
| Middleware — API | <http://127.0.0.1:8080> |
| Middleware — Docs (Swagger) | <http://127.0.0.1:8080/docs> |

> ⚠️ Os dois frontends usam a porta `5173` por padrão — **rode um de cada vez**, ou ajuste a porta de um deles no `vite.config.js`.

---

## 🔐 Segurança

- **Nunca commite o arquivo `.env`** — ele está no `.gitignore`.
- O `SUPABASE_KEY` (anon key) é seguro para uso no frontend, mas mantenha-o no `.env`.
- O `SECRET_KEY` do Sistema B **deve ser gerado por cada instalação** (nunca reutilize o de outro ambiente).
- As pastas `node_modules/` e `.venv/` **não são commitadas** — serão criadas localmente.

---

## ❓ Problemas comuns

| Problema | Solução |
|---|---|
| `python: command not found` no Windows | Reinstale Python marcando "Add to PATH". |
| Porta 5173 já em uso | Encerre o outro frontend ou rode `npm run dev -- --port 5174`. |
| Sistema B não conecta ao banco | Verifique se o PostgreSQL está rodando e a `DATABASE_URL` no `.env`. |
| `psql` não encontrado no Windows | Adicione `C:\Program Files\PostgreSQL\<versão>\bin` ao PATH. |
