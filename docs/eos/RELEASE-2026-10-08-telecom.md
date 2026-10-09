# Release: telecomunicaciones y conectividad

## Identidad

```yaml
release_id: mapa-peru-analitico-telecom-2026-10-08
status: VERIFIED
owner: oprbguitar
prepared_by: Codex
candidate_revision: 386e5fcf2f969f3087a74f448500506ce7bf2f38
artifact_ref: 386e5fcf2f969f3087a74f448500506ce7bf2f38
artifact_hash: 386e5fcf2f969f3087a74f448500506ce7bf2f38
environment: production
target: Render web service mapa-peru-analitico
prepared_at: 2026-10-08 America/Lima
published_at: 2026-10-08 19:53 America/Lima
verified_at: 2026-10-08 19:53 America/Lima
previous_release_ref: 4af52bd48e65832001671da1417c7ada8694d84d
```

## Alcance y autorización

Se incorporó cobertura móvil OSIPTEL declarada por centro poblado (corte 2025), con filtros por operadora, tecnología y medida, y objetos telecom de OpenStreetMap en el área visible. La familia Infraestructura presenta estas capas por separado y muestra procedencia y límites interpretativos. Se añadió la ingesta reproducible del CSV oficial y documentación de las fuentes y endpoints.

La cobertura OSIPTEL no representa ubicación de antenas ni calidad medida. OSM es colaborativo, puede estar incompleto y se consulta a través de Overpass. OpenCellID, PRONATEL y las simulaciones de priorización del adjunto quedan fuera de esta entrega: faltan una fuente, licencia o método suficientemente verificados para incorporarlos como capacidades activas.

La persona usuaria pidió explícitamente publicar la aplicación en producción y ya autorizó el repositorio público y el workspace de Render en esta tarea. No se cambiaron credenciales ni variables de entorno.

## Verificación

| Gate | Estado | Evidencia |
|---|---|---|
| Pruebas | PASS | `python -m unittest discover -s tests -v`: 69 pruebas; el pre-push `pytest -q`: 69 pasaron y 2 subtests pasaron. |
| JavaScript y diff | PASS | `node --check` en `telecom.js`, `rail.js` y `main.js`; `git diff --check`. |
| UI | PASS | `design-lint.mjs .`: APROBADO, genericidad 0. La categoría Infraestructura y sus selectores se cargaron en navegador local. |
| API y fuentes local | PASS | Consulta del endpoint OSIPTEL para Lima/Callao devolvió puntos con procedencia y corte 2025. Overpass devolvió objetos OSM para la vista de Lima con atribución ODbL. |
| Secretos y datos | PASS | El CSV de origen, `data/config.local.json` y `data/cameras.local.json` están ignorados por Git. El Parquet publicado deriva del dataset público OSIPTEL y su checksum figura en el catálogo. |
| Push | PASS | `origin/main` avanzó de `4af52bd` a `386e5fc`. |
| Render | PASS | Deploy `dep-db43ll4s728c739eeoag`, estado `live`, commit `386e5fcf2f969f3087a74f448500506ce7bf2f38`; `/api/v1/health` respondió HTTP 200. |
| Acceso web sin autenticar | PASS | La página raíz devolvió HTTP 401, consistente con la protección Basic Auth ya configurada. |

El servicio tenía auto-deploy activo, pero no inició un build después del push; tras comprobar que seguía en la revisión anterior, se inició el deploy de ese mismo commit con la API de Render. No se limpió la caché.

## Operación, riesgos y reversión

- URL: <https://mapa-peru-analitico.onrender.com>
- La protección Basic Auth de Render sigue activa; la API pública de salud queda disponible para la comprobación de plataforma.
- Overpass puede devolver indisponibilidad temporal; la API responde de forma controlada y la UI permite reintentar moviendo el mapa.
- No hubo migración de base de datos ni mutación de datos persistentes. El dataset normalizado está versionado con el código.
- Reversión: desplegar el commit previo `4af52bd48e65832001671da1417c7ada8694d84d` (deploy anterior `dep-db437dflk1mc73elchr0`) desde Render. La reversión no se ejecutó ni se ensayó en producción.
- La URL y la salud del servidor fueron verificadas públicamente; no se probó autenticación con contraseña ni la consulta de cobertura contra el backend productivo.
