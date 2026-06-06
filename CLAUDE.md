<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/001-log-gateway-api/plan.md` (with `research.md`, `data-model.md`,
`contracts/openapi.yaml` and `quickstart.md` in the same folder).
<!-- SPECKIT END -->

<!-- MANUAL ADDITIONS START -->

## Project Agent Instructions

### Idioma

- Comunícate siempre con el usuario en español.
- Escribe en español todas las instrucciones, explicaciones, planes, resúmenes, mensajes de progreso y salidas finales.
- Si una herramienta, comando, API o librería requiere texto técnico en inglés, úsalo solo donde sea necesario y explica el contexto en español.

### Documentos normativos del proyecto

- Especificación funcional: `F:\Apps\api-openobserve\specs\001-log-gateway-api\spec.md`.
- Constitución del proyecto y reglas de diseño: `F:\Apps\api-openobserve\.specify\memory\constitution.md`.
- Antes de implementar, modificar comportamiento o proponer arquitectura, revisa y respeta ambos documentos.
- Si hay discrepancias entre código, tareas, documentación y esos documentos, informa al usuario y solicita autorización antes de aplicar cambios que alteren comportamiento.

### Alcance y autorización de cambios

- Sigue estrictamente lo definido en `constitution.md` y `spec.md`.
- No modifiques comportamiento fuera de los criterios descritos en esos documentos.
- Si una tarea no está cubierta por esos documentos, propone cambios como diff, nota de diseño o pregunta de aclaración, pero no los apliques sin validación explícita.
- Antes de realizar refactors, optimizaciones o arreglos no especificados, pregunta y espera confirmación.
- Evita optimizaciones que cambien efectos observables si no están contempladas en `constitution.md` o `spec.md`.
- Si la intención de un cambio o nueva característica no está completamente clara, o existen huecos, dudas o ambigüedades, pregunta antes de implementar.

### Cumplimiento y trazabilidad

- Referencia siempre el criterio de aceptación, requisito funcional o sección normativa aplicable al realizar cambios.
- Si un criterio es ambiguo, pide aclaración en lugar de asumir comportamiento.
- Al finalizar una tarea, resume qué criterios o requisitos quedan cubiertos.
- Cualquier cambio de código que altere comportamiento observable debe reflejarse en `spec.md` antes de dar la tarea por terminada.
- Esto incluye correcciones de bugs que cambian comportamiento, ajustes de lógica, nuevas métricas, cambios en reglas de negocio y correcciones de campos.
- Solo se puede omitir la actualización de `spec.md` cuando el cambio sea puramente interno e invisible para el usuario, como renombrar una variable local o reformatear código. En ese caso, justifica brevemente por qué no requiere documentación.

### Documentación técnica y herramientas

- Para implementar código o consultar documentación técnica de lenguajes, librerías y frameworks, usa Context7 cuando esté disponible para consultar documentación reciente.
- Si Context7 no está disponible, usa documentación oficial y actualizada del proveedor correspondiente.
- Asegúrate de que la implementación cumple `constitution.md`, `spec.md` y la sintaxis moderna recomendada por la documentación vigente.
- Para commits, pull requests y operaciones con GitHub, puedes usar la aplicación `gh` instalada en el sistema cuando sea apropiado.

### Logging y diagnóstico

- El proyecto usa una arquitectura de logging estructurado.
- Durante desarrollo local, el servidor escribe logs en:
  - `F:\Apps\api-openobserve\.logs\app.log`: logs legibles por humanos.
  - `F:\Apps\api-openobserve\.logs\app.jsonl`: logs estructurados JSON Lines.
- Estos ficheros se sobrescriben en cada arranque de desarrollo y están ignorados por Git.
- Al diagnosticar problemas de arranque, errores runtime, flujos rotos, requests fallidos o comportamiento inesperado, revisa estos logs antes de especular.
- Usa `app.log` para inspección rápida y `app.jsonl` para análisis estructurado.
- El código de aplicación y features no debe usar llamadas directas a `console.*`; usa el wrapper compartido de logging.
- Los logs deben redactar secretos, tokens, credenciales, cookies, cabeceras `Authorization` e identificadores de sesión. Aun así, nunca copies datos sensibles desde logs a respuestas, commits, documentación o código generado.
- Al añadir funcionalidades, registra eventos operativos significativos mediante el contrato compartido de logging y asegúrate de que el nivel `debug` aporte valor diagnóstico real.

<!-- MANUAL ADDITIONS END -->
