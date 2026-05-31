# projeto PET Saúde 

Sistema web para agendamento de atendimentos em Unidades Básicas de Saúde 

---

## Requisitos
- Python 3.10+
- Node.js 18+
- npm

---

## Como rodar o Backend (FastAPI)

bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload

A API fica disponível em:
http://127.0.0.1:8000
Documentação: http://127.0.0.1:8000/docs

## Como rodar o Frontend (React + Vite)
cd frontend
npm install
npm run dev

fica disponível em:
http://localhost:5173