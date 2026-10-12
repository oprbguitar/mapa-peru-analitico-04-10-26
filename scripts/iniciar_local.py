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
    return [name for name in ('duckdb', 'openpyxl', 'h3', 'numpy', 'rasterio')
            if importlib.util.find_spec(name) is None]


def is_mapa(payload: object) -> bool:
    return isinstance(payload, dict) and payload.get('ok') is True and payload.get('app') == 'Mapa Perú Analítico'


def shutdown() -> int:
    """Cierra el mapa que corre en esta PC (puerto 8360) para que no quede cargando de fondo."""
    req = urllib.request.Request(URL + 'api/v1/local/shutdown', data=b'{}', method='POST',
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            json.load(response)
    except urllib.error.URLError as error:
        if isinstance(getattr(error, 'reason', None), ConnectionRefusedError) or 'refused' in str(error).lower() or '10061' in str(error):
            print('[i] El mapa ya estaba cerrado.')
            return 0
        print(f'[X] No se pudo cerrar el mapa: {error}')
        return 1
    print('[OK] Mapa cerrado. El puerto 8360 queda libre.')
    return 0


def ask_open_or_close() -> str:
    """Si el mapa ya está abierto y hay consola, el mismo botón permite abrirlo o cerrarlo."""
    if not sys.stdin or not sys.stdin.isatty():
        return 'a'
    print('[i] El mapa ya está abierto en http://127.0.0.1:8360/')
    try:
        answer = input('    [A] Abrir en el navegador   [C] Cerrar el mapa   (Enter = abrir): ').strip().lower()
    except EOFError:
        return 'a'
    return 'c' if answer.startswith('c') else 'a'


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    os.chdir(ROOT)
    if '--cerrar' in argv:
        return shutdown()
    if sys.version_info < (3, 11):
        print('[X] Se necesita Python 3.11 o superior.')
        return 1
    try:
        # Windows puede tardar más de dos segundos en rechazar un puerto libre.
        with urllib.request.urlopen(URL + 'api/v1/health', timeout=5) as response:
            if not is_mapa(json.load(response)):
                print('[X] El puerto 8360 está ocupado por otro servicio. No se detuvo ningún proceso.')
                return 1
        if ask_open_or_close() == 'c':
            return shutdown()
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
    print('[i] Mapa en http://127.0.0.1:8360/  ·  Para cerrarlo: botón ⏻ Cerrar mapa (menú ⋯), CERRAR-MAPA.bat, Ctrl+C o cerrar esta ventana.', flush=True)
    from peru_intel.__main__ import main as cli
    return cli(['serve', '--port', '8360', '--open'])


if __name__ == '__main__':
    sys.path.insert(0, str(ROOT))
    raise SystemExit(main())
