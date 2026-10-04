# Mapa Perú Analítico — reglas del proyecto

Plataforma standalone de inteligencia territorial del Perú. Antes de cambiar código lee `DOCUMENTACION.md`,
`docs/ROADMAP.md` y los ADR de `docs/adr/`.

## Reglas desde el primer commit

1. **Ningún número aparece sin procedencia.** Toda cifra debe responder: quién lo publicó, de qué fecha y
   período es, a qué nivel geográfico, cómo se transformó y cuándo se descargó (`provenance` en la API).
2. **La naturaleza del dato siempre se distingue**: oficial · en vivo de tercero · calculado · estimación ·
   proyección · interpretación IA.
3. **Nunca repartir** una cifra entre territorios de menor nivel. Si la fuente no publica el nivel, no se ofrece.
4. **La IA no calcula cifras ni el índice**; explica hechos numerados y pasa por el Verifier.
5. **Sin predicción ni ranking de personas.** Solo territorios y series agregadas.
6. **`data/raw` es inmutable.** Toda fuente nueva entra por `SourceHarvester` y se registra en el catálogo.
7. **Este sistema no depende de Route 360 ni de RUC360 para arrancar.** Route 360 podrá consultar `/api/v1/intel/*`.
8. UI: reglas del Pierre Design Harness (`DESIGN.md`, tokens en `apps/web/css/tokens.css`, `design-lint` aprobado).

## Verificación

```bash
python -m unittest discover -s tests -v
node "C:\Users\oprbg\Documents\Claude\AI-Design-Harness\bin\design-lint.mjs" .
```

<!-- EOS:BEGIN -->
## EOS 4.1.0 — Pierre R. Boss (oprbguitar)

Este proyecto adopta el Engineering Operating System de Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.
Las instrucciones locales anteriores a este bloque y las del host prevalecen; EOS no eleva permisos.

- Núcleo obligatorio: `.eos/EOS-CORE.md`. Su tabla de carga bajo demanda indica qué secciones abrir.
- Constitución `.eos/EOS_MASTER_SYSTEM_INSTRUCTION.md` y manuales `.eos/docs/manuals/`: solo por secciones, nunca completos por rutina.
- Roles: `.eos/agents/README.md`; cada entrega cierra con el bloque `eos-result` de `.eos/templates/AGENT-RESULT.md`.
- Procedimientos por modo (INIT, ADOPT, AUDIT, MIGRATE, RELEASE, INCIDENT): `.eos/skills/`.
- Plantillas de registro: `.eos/templates/`, incluida `EXEC-PLAN.md` para trabajo largo.

Ahorro de contexto (sin modelo, sin red):
- `node .eos/scripts/eos.mjs context "<tarea>" --mode <MODO> --list` muestra qué secciones cargar; sin `--list` entrega el paquete dentro del presupuesto (`--budget`, 8000 tokens por defecto).
- `node .eos/scripts/eos.mjs gate --json` ejecuta los comandos de `eos.gate.json` y devuelve solo fallos resumidos; exige revisión previa (`gate --plan`, luego `gate --trust` por el responsable).
- `node .eos/scripts/eos.mjs run --agent <rol> -- <comando del host>` ejecuta sin shell y registra tokens y costo reales en `~/.eos/runs/` (fuera del repositorio; la tarea solo como huella salvo `--log-task`); `runs` los resume.

Antes de cambiar código: inspecciona el repositorio, detecta el modo, respeta cambios ajenos y entrega evidencia verificable.
<!-- EOS:END -->
