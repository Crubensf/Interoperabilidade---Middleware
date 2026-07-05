@echo off
chcp 65001 >nul
title Iniciar Todos os Sistemas

echo ============================================================
echo   Iniciando todos os sistemas...
echo ============================================================
echo.

rem --------- Sistema A - Backend (Node) ---------
echo [1/5] Iniciando Sistema A (Backend)...
start "" /b cmd /c "cd /d "%~dp0Sistema A\Pet_Saude\backend" && npm run dev"

rem --------- Sistema A - Frontend (Vite) ---------
echo [2/5] Iniciando Sistema A (Frontend)...
start "" /b cmd /c "cd /d "%~dp0Sistema A\Pet_Saude\frontend" && npm run dev"

rem --------- Sistema B - Backend (Python) ---------
echo [3/5] Iniciando Sistema B (Backend)...
start "" /b cmd /c "cd /d "%~dp0Sistema B\backend" && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

rem --------- Sistema B - Frontend (Vite) ---------
echo [4/5] Iniciando Sistema B (Frontend)...
start "" /b cmd /c "cd /d "%~dp0Sistema B\frontend" && npm run dev -- --host"

rem --------- Middleware (FastAPI) ---------
echo [5/5] Iniciando Middleware...
start "" /b cmd /c "cd /d "%~dp0Middleware" && .venv\Scripts\python -m uvicorn app.main:app --reload --port 8080"

echo.
echo ============================================================
echo   Todos os servicos foram iniciados em segundo plano!
echo ============================================================
echo.
pause
