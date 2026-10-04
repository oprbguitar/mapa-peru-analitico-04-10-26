"""Proveedores en vivo. `load_all()` registra los workers (no consultan nada hasta que alguien pide la capa)."""


def load_all() -> None:
    from . import adsb, ais, celestrak, firms, seismic, traffic, weather  # noqa: F401
