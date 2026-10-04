@echo off
rem ==========================================================================
rem  Mapa Peru Analitico - autoarranque (doble clic)
rem  1. Verifica Python 3.11+   2. Instala dependencias la primera vez
rem  3. Arranca el servidor local y abre el navegador en http://127.0.0.1:8360
rem ==========================================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Mapa Peru Analitico

where python >nul 2>nul
if errorlevel 1 (
  echo [X] No se encontro Python. Instala Python 3.11 o superior desde https://www.python.org/downloads/
  echo     y marca "Add python.exe to PATH". Luego vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
if errorlevel 1 (
  echo [X] Se necesita Python 3.11 o superior.
  python --version
  pause
  exit /b 1
)

python -c "import duckdb, openpyxl" >nul 2>nul
if errorlevel 1 (
  echo [..] Primera ejecucion: instalando dependencias ^(duckdb, openpyxl^)...
  python -m pip install --disable-pip-version-check -q -r requirements.txt
  if errorlevel 1 (
    echo [X] No se pudieron instalar las dependencias. Revisa tu conexion a internet.
    pause
    exit /b 1
  )
)

python -c "import statsforecast" >nul 2>nul
if errorlevel 1 (
  echo [i] Proyecciones: se usara el metodo de respaldo. Para StatsForecast ejecuta:
  echo     python -m pip install -r requirements-forecast.txt
)

if not exist "data\parquet\sidpol_denuncias.parquet" (
  echo [..] No hay datos normalizados: descargando fuentes oficiales ^(puede tardar varios minutos^)...
  python -m peru_intel ingest all --download
)

set PORT=8360
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo [i] El servidor ya esta en ejecucion. Abriendo el navegador...
  start "" "http://127.0.0.1:%PORT%/"
  exit /b 0
)

echo.
echo  Mapa Peru Analitico en http://127.0.0.1:%PORT%/
echo  Cierra esta ventana (o pulsa Ctrl+C) para detener el servidor.
echo.
python -m peru_intel serve --port %PORT% --open
pause
