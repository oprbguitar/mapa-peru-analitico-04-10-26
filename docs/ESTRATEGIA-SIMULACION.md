# Ficha de estrategia — Laboratorio de simulación

EOS 4.2.0 · `eos-strategy`, fase 1 (dirección) y fase 2 (producto/ingeniería). Revisión: 11 de octubre de 2026.
Estados: **DICHO** (lo dijo el responsable) · **VERIFICADO** (comprobado en repositorio o ejecución) · **INFERIDO** · **PENDIENTE**.

## Admisión

| # | Pregunta | Respuesta | Estado |
|---|---|---|---|
| 1 | Problema y usuario | Explorar «¿qué pasaría si…?» sobre el territorio peruano (lluvia, cortes, sedes fuera) para planificar servicios y contingencias. Usuario principal: Pierre y su equipo de análisis territorial. | DICHO (plan maestro §7–§8) |
| 2 | Quién usa, paga y opera | Uso y operación locales en la PC de referencia; sin cobro definido. Productos piloto (Municipio 360, Crisis Room) son fase 8. | DICHO / PENDIENTE (modelo comercial) |
| 3 | Señal de valor | Que una persona sin formación en simulación obtenga y entienda un resultado A/B en menos de 1 minuto, sin leer documentación. | INFERIDO — medir en uso real |
| 4 | Primera entrega y exclusiones | Accesibilidad A/B (S1+S2+S9) y capacidad (S3). Fuera: red vial calibrada, agentes, optimización, cualquier uso operativo sobre personas. | VERIFICADO (commits `c931fb8` y S3) |
| 5 | Evidencia de demanda / marketing | Ninguna externa todavía. Marketing **DIFERIDO** hasta tener un piloto. | PENDIENTE |
| 6 | Capacidad (personas) | Operación unipersonal asistida por IA. Implica: interfaz autoexplicativa, pruebas automáticas y documentación en el repositorio. | DICHO |
| 7 | Restricciones | Solo local (no en Render); sin claves; datos RENIPRESS/OSM; reglas de AGENTS.md (procedencia, no repartir cifras, sin personas). | VERIFICADO |

## Áreas

| Área | Estado | Nota |
|---|---|---|
| Producto y dirección | EN ALCANCE | Prioridad dicha por el responsable: simulación y plan maestro. |
| Marketing y crecimiento | DIFERIDA | Sin piloto ni segmento elegido. |
| Personas (HR) | EVALUADA | Una persona; se compensa con UI guiada y pruebas. |
| Gestión y operación | EVALUADA | Responsable: Pierre R. Boss. Revisión al cerrar cada motor (S3, S5…). |
| Economía | NO APLICA (aún) | Sin costos de proveedor: todo local y sin claves. |
| País, regulación y confianza | EVALUADA | Perú. Solo territorios y agregados; resultados rotulados «estimación exploratoria». No se declara cumplimiento. |

## Próximo checkpoint

Al pasar a fase 3 (escenarios guardados y exportables) o al primer piloto: reabrir filas 2, 3 y 5.
