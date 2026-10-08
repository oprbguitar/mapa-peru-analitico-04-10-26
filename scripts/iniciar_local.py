"""Arranque nativo: sin contenedores, descargas de datos ni modelos automáticos."""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
URL = 'http://127.0.0.1:8360/'


def missing_dependencies() -> list[str]:
    return [name for name in ('duckdb', 'openpyxl', 'h3', 'numpy')
            if importlib.util.find_spec(name) is None]


def is_mapa(payload: object) -> bool:
    return isinstance(payload, dict) and payload.get('ok') is True and payload.get('app') == 'Mapa Perú Analítico'


def main() -> int:
    os.chdir(ROOT)
    if sys.version_info < (3, 11):
        print('[X] Se necesita Python 3.11 o superior.')
        return 1
    try:
        with urllib.request.urlopen(URL + 'api/v1/health', timeout=2) as response:
            if not is_mapa(json.load(response)):
                print('[X] El puerto 8360 está ocupado por otro servicio. No se detuvo ningún proceso.')
                return 1
        webbrowser.open(URL)
        return 0
    except urllib.error.URLError as error:
        if isinstance(error.reason, ConnectionRefusedError):
            pass  # nadie escucha en el puerto; se puede iniciar el servidor
        else:
            print('[X] No se pudo confirmar que el puerto 8360 esté libre. No se inició otro proceso.')
            return 1
    except (ValueError, OSError):
        print('[X] El puerto 8360 respondió de forma inesperada. No se inició otro proceso.')
        return 1
    missing = missing_dependencies()
    if missing:
        print('[..] Instalando dependencias del mapa: ' + ', '.join(missing), flush=True)
        result = subprocess.run([sys.executable, '-m', 'pip', 'install', '--disable-pip-version-check',
                                 '-r', str(ROOT / 'requirements.txt')], check=False)
        if result.returncode:
            print('[X] Instalación fallida. Revisa la conexión y vuelve a iniciar.')
            return result.returncode
    if not (ROOT / 'data/parquet/sidpol_denuncias.parquet').exists():
        print('[i] Sin datos SIDPOL locales. Para cargarlos: python -m peru_intel ingest all --download')
    print('[i] Inicio nativo. Cierra esta ventana o pulsa Ctrl+C para detener el mapa.', flush=True)
    from peru_intel.__main__ import main as cli
    return cli(['serve', '--port', '8360', '--open'])


if __name__ == '__main__':
    sys.path.insert(0, str(ROOT))
    raise SystemExit(main())
