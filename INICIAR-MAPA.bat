@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Mapa Peru Analitico - sin Docker
where python >nul 2>nul
if errorlevel 1 (
  echo [X] Instala Python 3.11 o superior y habilita Add Python to PATH.
  pause
  exit /b 1
)
python scripts\iniciar_local.py
if errorlevel 1 (
  echo [X] No se pudo iniciar el mapa. Revisa el mensaje anterior.
  pause
  exit /b 1
)
