@echo off
title Subir KetoTrack a GitHub
cd /d "%~dp0"

echo ========================================================
echo   Subiendo KetoTrack a danielantoniodiiorio-max/barriquero
echo ========================================================
echo.
echo Para autorizar el envio a GitHub:
echo - Usuario: danielantoniodiiorio-max
echo - Password: Tu Personal Access Token (o contrasena) de GitHub
echo.
"C:\Users\diioriod\AppData\Local\Programs\MinGit\cmd\git.exe" push -u origin main

echo.
pause
