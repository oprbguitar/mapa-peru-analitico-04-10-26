# plugins/vision-edge — cámaras y visión (opcional, no instalado)

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
| Endpoint de ingesta | Pendiente (fase 9) |
| Nodo edge | Fuera de este repositorio |
