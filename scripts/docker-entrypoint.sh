#!/bin/sh
# Primera ejecución: copia los datos semilla al volumen sin pisar lo que el usuario ya tenga.
set -e
if [ ! -f /app/data/.seeded ]; then
  echo "Preparando datos iniciales en /app/data…"
  cp -rn /app/seed/data/. /app/data/ 2>/dev/null || cp -r /app/seed/data/. /app/data/
  date > /app/data/.seeded
fi
# Dentro del contenedor se escucha en todas las interfaces; publica el puerto solo en 127.0.0.1 del anfitrión.
port="${PORT:-8360}"
exec python -m peru_intel serve --host 0.0.0.0 --port "$port" "$@"
