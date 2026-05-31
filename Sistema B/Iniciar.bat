@echo off
chcp 65001 >nul
title Sistema B - PET Saude UBS

REM ============================================================
REM  Inicia o Sistema B
REM   - Backend  : Python + FastAPI    -> http://127.0.0.1:8000
REM   - Frontend : React + Vite        -> http://localhost:5173
REM   - Requer PostgreSQL rodando (servico do Windows)
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   Sistema B - PET Saude UBS
echo ============================================================
echo.

REM --- Verifica Python ------------------------------------------
where python >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Python nao encontrado.
    echo        Instale em: https://www.python.org/downloads/
    echo        Marque "Add Python to PATH" durante a instalacao.
    pause
    exit /b 1
)

REM --- Verifica Node.js -----------------------------------------
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js / npm nao encontrado.
    echo        Instale em: https://nodejs.org/
    pause
    exit /b 1
)

REM --- Verifica PostgreSQL (opcional, apenas aviso) -------------
where psql >nul 2>nul
if errorlevel 1 (
    echo [AVISO] psql nao encontrado no PATH.
    echo         Certifique-se de que o PostgreSQL esta instalado e rodando.
    echo         Download: https://www.postgresql.org/download/windows/
    echo.
)

REM --- Verifica .env do backend ---------------------------------
if not exist "backend\.env" (
    echo [ERRO] Arquivo backend\.env nao encontrado.
    echo        Crie o arquivo com pelo menos:
    echo          DATABASE_URL=postgresql+psycopg://usuario:senha@localhost:5432/pet_ubs
    echo          SECRET_KEY=alguma-chave-forte
    pause
    exit /b 1
)

REM --- Instala dependencias Python, se necessario ---------------
echo [setup] Verificando dependencias Python...
python -m pip install --quiet -r backend\requirements.txt
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias Python.
    pause
    exit /b 1
)

REM --- Instala dependencias do frontend, se necessario ----------
if not exist "frontend\node_modules" (
    echo [setup] Instalando dependencias do frontend...
    pushd frontend
    call npm install
    popd
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar dependencias do frontend.
        pause
        exit /b 1
    )
)

REM --- Inicia backend em nova janela ----------------------------
echo [start] Iniciando backend em http://127.0.0.1:8000 ...
start "Sistema B - Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

REM --- Aguarda backend subir ------------------------------------
timeout /t 4 /nobreak >nul

REM --- Inicia frontend em nova janela ---------------------------
echo [start] Iniciando frontend em http://localhost:5173 ...
start "Sistema B - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host"

echo.
echo ============================================================
echo   Sistema B iniciado!
echo   Frontend : http://localhost:5173
echo   Backend  : http://127.0.0.1:8000
echo   API Docs : http://127.0.0.1:8000/docs
echo ============================================================
echo.
echo Feche as janelas abertas para encerrar os servicos.
echo.
pause
