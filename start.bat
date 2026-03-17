@echo off
echo ============================================
echo   Calculadora de Verbas Rescisórias
echo ============================================
echo.
echo Iniciando o servidor backend (porta 3001)...
start "Backend - Calculo Trabalhista" /D "%~dp0backend" cmd /k "node server.js"

echo Aguardando o backend iniciar...
timeout /t 3 /nobreak >nul

echo Iniciando o frontend React (porta 3000)...
start "Frontend - Calculo Trabalhista" /D "%~dp0frontend" cmd /k "npm start"

echo.
echo ============================================
echo  Sistema iniciado!
echo  Backend:  http://localhost:3001
echo  Frontend: http://localhost:3000
echo ============================================
echo.
echo Aguardando o frontend carregar (pode levar ~30 segundos)...
timeout /t 5 /nobreak >nul

start http://localhost:3000
