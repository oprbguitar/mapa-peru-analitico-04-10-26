# Mapa Perú Analítico — contenedor único, offline-first.
# Incluye: servidor, interfaz, datos normalizados (SIDPOL, INDECI, MTC, RENIPRESS, El Niño…), paquete territorial y la
# caché de mapas ya vista (funciona sin Internet). Con conexión se actualizan capas en vivo, clima, rutas y geocodificación.
#
#   docker build -t mapa-peru-analitico:0.3 .
#   docker run -p 127.0.0.1:8360:8360 -v mapa-peru-datos:/app/data mapa-peru-analitico:0.3
#
# Para llevarlo a otra PC sin Internet: scripts/exportar-contenedor.ps1 genera un único .tar (docker save).
FROM python:3.12-slim

ARG FORECAST=1
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 PIP_NO_CACHE_DIR=1 \
    PI_OLLAMA_URL=http://host.docker.internal:11434 \
    PI_AI_BASE_OLLAMA_LOCAL=http://host.docker.internal:11434

WORKDIR /app
COPY requirements.txt requirements-forecast.txt ./
RUN pip install -r requirements.txt && if [ "$FORECAST" = "1" ]; then pip install -r requirements-forecast.txt; fi

COPY peru_intel ./peru_intel
COPY apps ./apps
COPY config ./config
COPY plugins ./plugins
# datos semilla: se copian al volumen /app/data la primera vez (las descargas y ajustes posteriores persisten en el volumen)
COPY data/peru ./seed/data/peru
COPY data/parquet ./seed/data/parquet
COPY data/normalized ./seed/data/normalized
COPY data/catalog/manifest.json ./seed/data/catalog/manifest.json
COPY data/ofm ./seed/data/ofm
COPY data/tiles ./seed/data/tiles
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && useradd -m -u 10001 mapa && mkdir -p /app/data && chown -R mapa /app
USER mapa
VOLUME ["/app/data"]
EXPOSE 8360
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8360/api/v1/health',timeout=4)"
ENTRYPOINT ["docker-entrypoint.sh"]
