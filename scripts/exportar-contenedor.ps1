# Construye la imagen y la exporta a UN solo archivo (.tar) para llevarla a otra PC sin Internet.
#   powershell -ExecutionPolicy Bypass -File scripts\exportar-contenedor.ps1
# En la otra PC: copiar el .tar junto al proyecto (o solo el .tar + docker-compose.yml + INICIAR-CONTENEDOR.bat) y ejecutar
# INICIAR-CONTENEDOR.bat, que hace «docker load» automáticamente.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$tag = 'mapa-peru-analitico:0.3'
$out = 'mapa-peru-analitico-0.3.tar'
docker build -t $tag .
docker save -o $out $tag
$mb = [math]::Round((Get-Item $out).Length / 1MB)
Write-Host "Listo: $out ($mb MB). Contiene servidor, interfaz, datos normalizados y la caché de mapas."
Write-Host 'SHA-256:' (Get-FileHash $out -Algorithm SHA256).Hash
