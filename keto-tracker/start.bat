@echo off
title KetoTrack + Garmin Server
cd /d "%~dp0"

echo ========================================================
echo   Iniciando KetoTrack + Garmin (Prototipo Local)
echo ========================================================

REM Ejecutar con keto-server (Node.js 24 habilitado para red local)
start http://localhost:8000
set ELECTRON_RUN_AS_NODE=1
"C:\Users\diioriod\AppData\Local\Programs\antigravity\keto-server.exe" src\server.js

pause
