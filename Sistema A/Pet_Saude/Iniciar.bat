@echo off
chcp 65001 >nul
title Sistema A - Pet Saude

REM ============================================================
REM  Inicia o Sistema A (Pet_Saude)
REM   - Backend  : Node.js + Express   -> http://localhost:5050
REM   - Frontend : React + Vite        -> http://localhost:5173
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   Sistema A - Pet Saude
echo ============================================================
echo.

REM --- Verifica Node.js -----------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado.
    echo        Instale em: https://nodejs.org/
    pause
    exit /b 1
)

REM --- Instala dependencias do backend, se necessario -----------
if not exist "backend\node_modules" (
    echo [setup] Instalando dependencias do backend...
    pushd backend
    call npm install
    popd
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar dependencias do backend.
        pause
        exit /b 1
    )
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

REM --- Verifica .env do backend ---------------------------------
if not exist "backend\.env" (
    echo [AVISO] Arquivo backend\.env nao encontrado.
    echo         O backend pode falhar ao iniciar.
    echo.
)

REM --- Inicia backend em nova janela ----------------------------
echo [start] Iniciando backend em http://localhost:5050 ...
start "Sistema A - Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

REM --- Pequena espera para o backend subir ----------------------
timeout /t 3 /nobreak >nul

REM --- Inicia frontend em nova janela ---------------------------
echo [start] Iniciando frontend em http://localhost:5173 ...
start "Sistema A - Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ============================================================
echo   Sistema A iniciado!
echo   Backend  : http://localhost:5050
echo   Frontend : http://localhost:5173
echo ============================================================
echo.
echo Feche as janelas abertas para encerrar os servicos.
echo.
pause
