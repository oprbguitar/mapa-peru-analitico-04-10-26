@echo off
rem ==========================================================================
rem  Mapa Peru Analitico - contenedor unico (Docker Desktop)
rem  - Si existe mapa-peru-analitico-0.3.tar en esta carpeta, lo carga (uso sin Internet).
rem  - Si no, construye la imagen desde el codigo.
rem  - Arranca en http://127.0.0.1:8360 con datos persistentes en el volumen "mapa-datos".
rem ==========================================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Mapa Peru Analitico (contenedor)

where docker >nul 2>nul
if errorlevel 1 (
  echo [X] No se encontro Docker. Instala Docker Desktop desde https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)
docker info >nul 2>nul
if errorlevel 1 (
  echo [X] Docker Desktop no esta en ejecucion. Abrelo y vuelve a intentar.
  pause
  exit /b 1
)

docker image inspect mapa-peru-analitico:0.3 >nul 2>nul
if errorlevel 1 (
  if exist mapa-peru-analitico-0.3.tar (
    echo [..] Cargando la imagen desde mapa-peru-analitico-0.3.tar ...
    docker load -i mapa-peru-analitico-0.3.tar || goto :error
  ) else (
    echo [..] Construyendo la imagen por primera vez - puede tardar varios minutos ...
    docker compose build || goto :error
  )
)

set PERFILES=
if /i "%1"=="voz" set PERFILES=--profile voz
if /i "%1"=="todo" set PERFILES=--profile voz --profile camaras
docker compose %PERFILES% up -d || goto :error
echo.
echo [OK] Mapa Peru Analitico en http://127.0.0.1:8360/
echo      Detener: docker compose down     Voz local: INICIAR-CONTENEDOR.bat voz
timeout /t 4 >nul
start "" http://127.0.0.1:8360/
exit /b 0

:error
echo [X] Algo fallo. Revisa el mensaje anterior.
pause
exit /b 1
