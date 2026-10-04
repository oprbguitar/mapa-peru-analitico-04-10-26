# Perfil de proyecto — Biblioteca EOS

**Autoría y dirección: Pierre R. Boss (oprbguitar). Desarrollo documental asistido por IA.**

| Campo | Valor confirmado o decisión de esta edición |
|---|---|
| Producto | Biblioteca de instrucciones de ingeniería EOS |
| Edición | 4.1.0: doce especificaciones mayores (pisos congelados), núcleo EOS-CORE y CLI `eos.mjs` endurecido (run sin shell, gate con confianza por revisión, router de política, evaluación dev/holdout/adversarial) |
| Propietario editorial | Pierre R. Boss / oprbguitar |
| Repositorio | `oprbguitar/dev-funcy-agents-03-10-26` |
| Modo de este trabajo | ADOPT: conservar y ampliar una constitución existente |
| Público | Propietario, colaboradores autorizados y agentes asistentes |
| Idioma de ampliación | Español de Perú; constitución histórica conservada en inglés |
| Criticidad del repositorio | L1 documental; instrucciones aplicables a productos L0–L4 |
| Entorno de edición | Windows / PowerShell; verificación portable con Node |
| Persistencia | Git, Markdown, JSON, adjuntos fuente de texto |
| Publicación autorizada | Subir esta ampliación al repositorio indicado por el propietario |
| Visibilidad observada al iniciar | Privada; no se autoriza cambiarla |
| Dependencias de herramientas | Biblioteca estándar de Node.js; sin paquetes npm |
| Herramientas ejecutables | `validate-library.mjs`, `install-agents.mjs` (instalar y `--update`), `eos.mjs` |
| Aplicación desplegada | No aplica a esta biblioteca |
| Datos de usuarios finales | No se requiere recolectarlos |
| Pagos y facturación | DORMANT: documentación y contratos, sin operaciones financieras |
| IA del producto | DORMANT: documentación del puerto; no runtime, modelos ni claves |
| Seguridad operacional | Manuales propuestos; sin servicios de defensa desplegados |
| Administración UI | Propuesta por producto; no frontend en este alcance |
| Sistema de agentes | 13 definiciones en `agents/`, plugin Claude Code, instalador para Claude/Codex; sin procesos ni permisos propios |
| Hosts declarados | Claude Code (plugin, subagentes, skills), Codex (AGENTS.md, `.agents/skills`), lectura manual en otros hosts |
| Automatizaciones y scouts | Procedimientos documentados; sin tareas programadas creadas |
| Costos nuevos | No se solicita contratar servicios ni ejecutar jobs de pago |
| Evidencia de esta edición | Tests, enlaces locales, hashes, revisión y Git remoto |

No se fijan SLO, concurrencia, RTO o RPO de una aplicación inexistente. Cada producto debe completar su propio perfil y decidir estas magnitudes con requisitos y mediciones. Las fuentes guardadas corresponden a los cuatro archivos entregados en esta conversación; no se incorporan otros chats, memorias privadas ni datos de terceros.

## Criterios de aceptación

1. Conservar los principios y la firma existentes.
2. Desarrollar los cuatro antecedentes en instrucciones concretas y trazables.
3. Mantener rutas claras para lectura, adopción, ejecución y revisión.
4. Distinguir política propuesta, implementación y verificación.
5. No introducir secretos, servicios de pago ni cambios de visibilidad.
6. Validar el código de soporte y demostrar publicación Git.
7. Superar 1,000 líneas de contenido en cada módulo mayor, según la aclaración expresa del propietario en esta conversación: «Each major instruction module».
8. Cumplir el piso editorial de 12,000 palabras por módulo sin envolver frases ni repetir instrucciones para rellenar el documento.
9. Desarrollar contratos, invariantes, concurrencia, escenarios de fallo y decisiones con evidencia, sujetos a revisión específica del dominio.

Los límites numéricos son requisitos documentales de esta edición. Se registran por módulo en [DEPTH-REPORT.md](DEPTH-REPORT.md), y su verificación se reproduce con [VERIFICATION.md](VERIFICATION.md). No asignan una garantía a una implementación futura ni obligan a cargar todos los módulos simultáneamente en un modelo.
