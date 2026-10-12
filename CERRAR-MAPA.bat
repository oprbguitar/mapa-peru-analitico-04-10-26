@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Mapa Peru Analitico - cerrar
python scripts\iniciar_local.py --cerrar
timeout /t 3 >nul
