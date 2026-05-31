@echo off
chcp 65001 >nul
title Middleware - FHIR

REM ============================================================
REM  Inicia o Middleware (FastAPI)
REM   - Servidor : Python + FastAPI    -> http://127.0.0.1:8080
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   Middleware - FHIR
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

REM --- Cria virtualenv, se nao existir --------------------------
if not exist ".venv" (
    echo [setup] Criando virtualenv...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERRO] Falha ao criar o virtualenv.
        pause
        exit /b 1
    )
)

REM --- Ativa o virtualenv ---------------------------------------
call ".venv\Scripts\activate.bat"
if errorlevel 1 (
    echo [ERRO] Falha ao ativar o virtualenv.
    pause
    exit /b 1
)

REM --- Instala dependencias -------------------------------------
echo [setup] Verificando dependencias Python...
pip install --quiet -r requirements.txt
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
)

REM --- Verifica .env --------------------------------------------
if not exist ".env" (
    echo [AVISO] Arquivo .env nao encontrado.
    if exist ".env.example" (
        echo         Copie .env.example para .env e ajuste os valores.
    )
    echo.
)

REM --- Define porta ---------------------------------------------
if "%MIDDLEWARE_PORT%"=="" set MIDDLEWARE_PORT=8080

echo.
echo ============================================================
echo   Middleware iniciado!
echo   URL      : http://127.0.0.1:%MIDDLEWARE_PORT%
echo   API Docs : http://127.0.0.1:%MIDDLEWARE_PORT%/docs
echo ============================================================
echo.
echo Pressione Ctrl+C para encerrar.
echo.

REM --- Inicia o servidor ----------------------------------------
python -m uvicorn app.main:app --reload --port %MIDDLEWARE_PORT%

pause
