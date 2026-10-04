"""CLI: python -m peru_intel <comando>

  serve [--port 8360] [--host 127.0.0.1] [--no-live]   servidor local + mapa
  build-territory [--from DIR]                          paquete territorial data/peru/
  ingest <fuente|all> [--download] [--dir DIR]           sidpol | indicadores | mpfn | devida | ports | all
  sources                                               registro de fuentes y su estado
  index                                                 recalcula el Índice Situacional v1
  export-ofm                                            copia a data/ofm las teselas de Perú ya vistas en RUC360
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import config


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # consola de Windows
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(prog="peru_intel", description="Mapa Perú Analítico")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("serve")
    s.add_argument("--port", type=int, default=int(config.setting("port", "8360")))
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--no-live", action="store_true", help="no arrancar proveedores en vivo")
    s.add_argument("--open", action="store_true", help="abrir el navegador")
    b = sub.add_parser("build-territory")
    b.add_argument("--from", dest="src", type=Path)
    i = sub.add_parser("ingest")
    i.add_argument("source", choices=["sidpol", "indicadores", "mpfn", "devida", "ports", "all"])
    i.add_argument("--download", action="store_true", help="descargar del portal oficial (si no, usa copias locales)")
    i.add_argument("--dir", type=Path, help="carpeta con archivos ya descargados")
    sub.add_parser("sources")
    sub.add_parser("index")
    sub.add_parser("export-ofm")
    a = ap.parse_args(argv)
    config.ensure_dirs()

    if a.cmd == "serve":
        from .backend.server import run
        run(a.host, a.port, live=not a.no_live, open_browser=a.open)
    elif a.cmd == "build-territory":
        from .map import territory
        print(json.dumps(territory.build(a.src), ensure_ascii=False, indent=2))
    elif a.cmd == "ingest":
        from .ingestion import run_ingest
        for line in run_ingest(a.source, download=a.download, folder=a.dir):
            print(line)
    elif a.cmd == "sources":
        from .sources import registry
        registry.sync()
        for r in registry.all_sources():
            print(f"{r['status']:<14} {r['kind']:<13} {r['source_id']:<24} {r['last_downloaded'] or '—'}")
    elif a.cmd == "index":
        from .analytics import index
        res = index.compute()
        print(json.dumps({k: v for k, v in res.items() if k != "regions"}, ensure_ascii=False, indent=2))
        for r in sorted(res["regions"], key=lambda r: -(r["score"] or -1))[:25]:
            print(f"{r['nombre']:<16} {r['score'] if r['score'] is not None else '—':>6}  cobertura {r['coverage']:.0%}")
    elif a.cmd == "export-ofm":
        from .map import ofm_proxy
        print(ofm_proxy.export_from_ruc360())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
