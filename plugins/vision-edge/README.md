# plugins/vision-edge — cámaras y visión (instalado en v0.3)

Módulo **opcional**. El sistema arranca y funciona sin él. Aquí vive solo el **contrato**; la implementación
(Route 360 o un nodo edge propio) se conecta publicando eventos con este formato.

## Flujo previsto

```text
Dahua / Hikvision / Axis / ONVIF / RTSP
              │
              ▼
           go2rtc                (AlexxIT/go2rtc — restream RTSP/WebRTC)
              │
       YOLO26 / ultralytics      (personas y vehículos)
              │
          ByteTrack              (seguimiento)
        ┌─────┴─────┐
     PERSON       VEHICLE
        │             │
      YuNet       LPD_YuNet      (opencv_zoo)
        │             │
      SFace       PaddleOCR → EasyOCR (respaldo)
        └─────┬───────┘
            EVENT  ──► POST /api/v1/intel/events (futuro, autenticado)
```

Primer equipo de ensayo: Dahua DH-XVR5108HS-X. El contrato es agnóstico de fabricante.

## Contrato de evento (`event.schema.json`)

Ver [event.schema.json](event.schema.json). Reglas:

- El evento lleva **ubicación y UBIGEO** para agregarse al mapa por territorio.
- Datos biométricos (embeddings de rostro) **nunca** salen del nodo edge; al sistema solo llegan conteos,
  clases y, si la ley y la autorización lo permiten, placas.
- Retención y base legal: Ley N.º 29733 (protección de datos personales) y su reglamento. Revisar con
  `eos-compliance-analyst` antes de habilitar cualquier dato personal.
- Prohibido: puntajes o predicciones sobre personas individuales.

## Estado

| Pieza | Estado |
|---|---|
| Contrato de evento | Definido (este directorio) |
| Registro de grabadores y canales | ✅ `peru_intel/vision/cameras.py` (contraseña solo en el servidor; solo red local) |
| Prueba de conexión Dahua (CGI Digest), nombres de canal, foto y RTSP | ✅ `peru_intel/vision/device.py` |
| Búsqueda en la red (ONVIF + puertos 37777/554/80) | ✅ `peru_intel/vision/discovery.py` |
| Visor y mosaico en el mapa; go2rtc opcional | ✅ botón «Cámaras» |
| Endpoint de ingesta | ✅ `POST /api/v1/intel/vision/events` (token opcional `vision_token`; placas descartadas sin `vision_allow_plates`) |
| Nodo edge (YOLO, ByteTrack…) | Fuera de este repositorio |

## Conectar el Dahua DH-XVR5108HS-X

1. XVR al mismo router que la PC (Ethernet). En el XVR: Menú → Red → TCP/IP, anota la IP.
2. Red → Puerto: HTTP 80, RTSP 554 (37777 es el puerto propio de Dahua). Activa ONVIF y CGI si el firmware lo muestra.
3. Crea un usuario solo de vista en vivo.
4. En el mapa: **Cámaras** → «Buscar en mi red» o escribe la IP → usuario/contraseña → «Probar conexión» → «Guardar».
5. «Ubicar» cada canal y haz clic en el mapa. «Ver» o «Mosaico» para mirarlos.
6. Video fluido: «Generar go2rtc.yaml» → `go2rtc.exe -config data\vision\go2rtc.yaml` (o `docker compose --profile camaras up -d`).

RTSP: `rtsp://usuario:clave@IP:554/cam/realmonitor?channel=1&subtype=1` (0 principal, 1 secundario).
