# EOS · MODE=AUDIT — auditoría inicial

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**
Fecha: 2026-10-04 · Revisión: primer commit · Método: revisión de código, pruebas (`tests/`) y ejecución real.
Independencia limitada: la misma sesión implementó y auditó; se recomienda una segunda revisión con
`eos-security-reviewer` y `eos-compliance-analyst` en sesión separada.

## Hallazgos por severidad

| ID | Sev. | Área | Hallazgo | Estado |
|---|---|---|---|---|
| A-01 | Media | Seguridad | Las claves BYOK (TomTom, AIS, FIRMS, API externa) se guardan en texto plano en `data/config.local.json` (ignorado por git). RUC360 usa DPAPI. | Abierto: migrar a DPAPI/keyring en Windows |
| A-02 | Media | Licencias | Datos de terceros con términos propios: adsb.lol (ODbL), OSM/OpenFreeMap (ODbL, atribución), Open-Meteo (CC BY 4.0, atribución), TomTom (comercial, BYOK), aisstream.io (términos), NASA FIRMS (MAP_KEY). El código de God's Eye View es MIT pero **sus fuentes no**. | Mitigado en local (atribución en mapa y registro); revisar antes de cualquier uso comercial |
| A-03 | Media | Calidad de datos | SIDPOL solo publica 7 modalidades («Otros» agrupa el resto). MPFN se agrega por sede del distrito fiscal, no por lugar del hecho. | Declarado en la interfaz y en `provenance` |
| A-04 | Baja | Calidad de datos | La población es proyección INEI publicada por MININTER (estimación, no censo); 16 distritos sin población en 2025. | Tasa = null cuando falta; nunca se imputa |
| A-05 | Baja | Cartografía | 8 distritos sin geometría y 1 provincia faltante en la cartografía simplificada. | Registrado en `data/peru/metadata.json` |
| A-06 | Baja | IA | El Verifier valida números y citas, no la semántica del período. | ADR-0004; hechos con período explícito |
| A-07 | Info | Cobertura | AIS, TomTom, FIRMS y SENAMHI no se probaron con claves reales en esta sesión. | Pendiente de prueba con claves |
| A-08 | Info | Rendimiento | Primera proyección StatsForecast compila con numba (~13 s); siguientes < 1 s. | Aceptado |

## Controles verificados

- Servidor en 127.0.0.1; CSP `default-src 'self'`; POST exige JSON y mismo origen (prueba `test_cross_origin_post_rejected`).
- Rutas estáticas confinadas a `apps/web` (prueba de path traversal).
- Las claves nunca vuelven al navegador (`/api/v1/meta/settings` solo devuelve booleanos).
- `data/raw` inmutable: un contenido distinto genera otro archivo; un contenido idéntico se reutiliza (prueba).
- Sin reparto de cifras entre territorios (prueba: suma distrital de Cusco = total departamental).
- Fórmula de tasa y reproducibilidad del índice (pruebas).
- Rechazo de preguntas sobre personas en el agente de IA.

## Privacidad

No se procesan datos personales: todas las fuentes activas son agregadas o de objetos (aeronaves, barcos,
satélites). El módulo de cámaras queda fuera (contrato en `plugins/vision-edge/`) y exige revisión de la
Ley N.º 29733 antes de habilitar cualquier dato personal.
