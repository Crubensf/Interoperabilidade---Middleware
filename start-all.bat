@echo off
chcp 65001 >nul
title Interoperabilidade - sobe os 3 sistemas

REM ============================================================
REM  Sobe Sistema A + Sistema B + Middleware (cada um em sua janela)
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   Interoperabilidade - inicializando os 3 sistemas
echo ============================================================
echo.

REM --- Sistema A ------------------------------------------------
echo [1/3] Iniciando Sistema A (http://localhost:5050)...
start "Sistema A" cmd /k "cd /d "%~dp0Sistema A\Pet_Saude" && Iniciar.bat"

timeout /t 5 /nobreak >nul

REM --- Sistema B ------------------------------------------------
echo [2/3] Iniciando Sistema B (http://127.0.0.1:8000)...
start "Sistema B" cmd /k "cd /d "%~dp0Sistema B" && Iniciar.bat"

timeout /t 10 /nobreak >nul

REM --- Middleware -----------------------------------------------
echo [3/3] Iniciando Middleware (http://127.0.0.1:8080)...
start "Middleware" cmd /k "cd /d "%~dp0Middleware" && Iniciar.bat"

echo.
echo ============================================================
echo   3 sistemas no ar (3 janelas abertas).
echo   Sistema A  : http://localhost:5173 (front) / :5050 (back)
echo   Sistema B  : http://localhost:5174 (front) / :8000 (back)
echo   Middleware : http://127.0.0.1:8080 (dashboard em /dashboard)
echo ============================================================
echo.
echo Feche as 3 janelas abertas para encerrar.
pause
