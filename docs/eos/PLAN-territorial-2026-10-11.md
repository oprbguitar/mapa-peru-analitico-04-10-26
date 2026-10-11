# Integración territorial fechada — plan de ejecución

Modo EOS: ADOPT con RELEASE. Responsable: Pierre R. Boss. Orquestador: Codex.
Autorización: solicitud del 11 de octubre de 2026 para implementar, subir a GitHub y publicar en la web existente.

## Resultado
Seleccionar áreas, consultar escenas Sentinel-2 con metadatos de adquisición, comparar dos escenas y descargar un recorte georreferenciado.
Consultar telecomunicaciones, reproducir las posiciones ADS-B históricas disponibles e incorporar Mapillary donde haya datos.
Reemplazar el simulador meteorológico por imágenes satelitales NOAA con tiempo publicado.

## Hitos y ownership
1. Satélite: agente satellite — módulos nuevos de imágenes, visor y pruebas; root integra rutas.
2. Telecom: agente telecom — consulta OSM, cobertura, render y pruebas.
3. Vuelo/calle: agente flight_street — históricos, reproducción 3D, Mapillary y pruebas.
4. Nubes: agente clouds — referencia GOdEyes en solo lectura, adaptador NOAA, capa y pruebas.
5. Root: controles comunes, contratos API, documentación, revisión, verificación y despliegue.

## Invariantes y límites
Sin fechas inferidas como adquisiciones. OSM incompleto no demuestra ausencia de cobertura.
La altitud ADS-B barométrica no equivale a altura sobre terreno. No interpolar huecos largos como posiciones observadas.
Claves Mapillary solo en backend. Fuentes públicas y sus cuotas condicionan la disponibilidad.
Recortes limitados para proteger memoria del servicio Render Free. No tocar GOdEyes ni originales raw.

## Verificación y reversión
Pruebas unitarias y de contrato, proveedores reales, navegador a 360/768/1280/1600, design-lint y revisión de seguridad.
Publicar solo archivos propios tras revisar diff; Render autoDeploy en main. Comprobar despliegue del commit y salud pública.
Reversión: revertir el commit de esta entrega y dejar que Render despliegue; no modifica datos originales.

## Progreso
- Inspección: repositorio limpio; web Render y origen GitHub comprobados; ADR y fuentes existentes revisados.
- Implementación: escenas Sentinel-2/AOI/GeoTIFF, telecom, histórico ADS-B/3D, Mapillary y NOAA conectados a la API y navegación.
- Aceptación local: 107 pruebas Python; cobertura de módulos de estas capas 90 %; design-lint 0/APROBADO;
  navegador fixture PASS a 360/768/1280/1600, antenas persistentes al cambiar base y dibujo/reproducción WebGL.
- Proveedores: STAC real 6/3 de octubre; GeoTIFF real 111×113 EPSG:32718 y recorte final 23×23, ambos con adquisición verificada;
  NOAA hora publicada 16:00 UTC y PNG real 48 268 bytes. OSM consulta inicial 13 objetos, posteriormente 500/504 externos.
- Navegador real: escenas A/B PASS, descarga GeoTIFF PASS, nubes NOAA fechadas PASS y trayectoria ADS-B `e80481` con ocho posiciones PASS.
  Sin errores JavaScript. La comprobación OSM posterior quedó DEGRADED por el proveedor, separada de las pruebas de render.
- Corregida carga de nubes con otras teselas pendientes: un estilo inicializado admite la capa aunque no todas sus fuentes hayan terminado de cargar.
- Seguridad: revisión sin bloqueos; pip-audit núcleo/imágenes/pronósticos sin vulnerabilidades conocidas.
- Ajustes de recursos: solo una tesela raster procesada a la vez para reservar otro slot a exportación; resolución de metadatos STAC sin duplicar peticiones concurrentes.
- Publicación: preparada para GitHub main → autoDeploy del servicio Render existente; verificar commit, estado live, versión 0.5.0 y protección HTTP.
- Limitación: Mapillary real pendiente de clave; Render efímero y autenticación pública conservada. No hay credenciales públicas disponibles para una navegación autenticada de producción en esta sesión.
