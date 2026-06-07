# Log Gateway Constitution

## Core Principles

### I. Stack cerrado y versionado

El proyecto MUST implementarse como una API backend en NestJS + TypeScript. No se permite sustituir el framework principal, el lenguaje ni el motor de observabilidad sin una enmienda formal de esta constitución.

Versiones obligatorias para el MVP:

| Componente | Versión obligatoria | Regla |
|---|---:|---|
| Node.js | 24 LTS; Docker target `node:24.16.0-bookworm-slim` | Runtime único permitido para app y CI. |
| npm | 11.4.2 o compatible con Node 24 LTS | Gestor de paquetes obligatorio. No usar yarn/pnpm en MVP. |
| TypeScript | 6.0.3 | `strict: true` obligatorio. |
| `@nestjs/cli` | 11.0.21 | Scaffolding, build y comandos Nest. |
| NestJS core | 11.1.24 | Framework HTTP obligatorio. |
| `@nestjs/common` | 11.1.24 | Primitivas compartidas NestJS. |
| `@nestjs/platform-express` | 11.1.24 | Adaptador HTTP por defecto. |
| `@nestjs/config` | 4.0.4 | Configuración y validación de entorno. |
| `@nestjs/axios` | 4.0.1 | Cliente HTTP hacia OpenObserve si se usa wrapper Nest. |
| `axios` | 1.17.0 | Cliente HTTP subyacente hacia OpenObserve. |
| `@nestjs/throttler` | 6.5.0 | Rate limiting por API key. |
| `zod` | 4.4.3 | Validación de payloads, configuración y esquemas internos. |
| `pino` | 10.3.1 | Logging estructurado. |
| `nestjs-pino` | 4.6.1 | Integración NestJS + Pino. |
| `loglevel` | 1.9.2 | Logging en snippets/clientes frontend si el proyecto entrega código browser. |
| `prom-client` | 15.1.3 | Métricas Prometheus. |
| `helmet` | 8.2.0 | Cabeceras HTTP de seguridad. |
| `uuid` | 14.0.0 | Identificadores de request/eventos auxiliares. |
| `reflect-metadata` | 0.2.2 | Metadata requerida por NestJS. |
| `rxjs` | 7.8.2 | Dependencia reactiva requerida por NestJS. |
| Jest | 30.4.2 | Test runner obligatorio para MVP. |
| `@swc/core` | 1.15.40 | Compilación/transpile rápido para tests y build auxiliar si aplica. |
| `@swc/jest` | 0.2.39 | Transform TypeScript para Jest. |
| `@swc/helpers` | 0.5.23 | Helpers SWC. |
| `@nestjs/testing` | 11.1.24 | Testing NestJS. |
| `supertest` | 7.2.2 | Tests HTTP de integración/E2E. |
| ESLint | 10.4.1 | Lint obligatorio. |
| `typescript-eslint` | 8.60.1 | Reglas TypeScript. |
| Prettier | 3.8.3 | Formato obligatorio. |
| `@types/node` | 24.13.1 | Tipos Node alineados con Node 24. |
| `@types/jest` | 30.0.0 | Tipos Jest. |
| OpenObserve OSS | 0.90.3 como versión objetivo validada | Si se usa otra versión, MUST repetirse la validación de endpoints `_json`, `_multi` y `_search`. |
| Postman Collection | schema 2.1.0 | Formato obligatorio de colección manual. |

Las dependencias deben fijarse en `package-lock.json`. Se permiten parches compatibles dentro del mismo major solo mediante actualización explícita del lockfile y ejecución completa de quality gates. No se permiten dependencias prerelease, alpha, beta, canary o `next` en MVP.

### II. Arquitectura por capas y separación de responsabilidades

El código MUST mantener separación estricta entre transporte HTTP, lógica de aplicación, dominio y adaptadores externos.

Estructura obligatoria:

- `controllers`: solo HTTP, validación de entrada ya parseada, status codes y DTOs de salida.
- `application/services`: casos de uso (`ingest logs`, `query logs`, `list services`, `health`, `metrics`).
- `domain`: tipos, políticas, normalización, autorización, redacción, límites y reglas puras.
- `infrastructure/openobserve`: cliente OpenObserve y traducción de contratos internos a API O2.
- `infrastructure/config`: carga y validación de variables, API keys y límites.
- `infrastructure/queue`: cola y workers de entrega cuando la spec los requiera.
- `infrastructure/metrics`: contadores, histogramas y gauges Prometheus.
- `infrastructure/logging`: Pino, request IDs y logs internos.

Los controllers MUST NOT llamar directamente a OpenObserve, leer secretos, construir SQL ni aplicar reglas de autorización complejas. Las reglas de negocio MUST ser testeables sin levantar NestJS ni OpenObserve.

### III. Seguridad y privacidad por defecto

La API MUST proteger credenciales, secretos de cliente y acceso a logs incluso cuando una API key frontend sea pública en la práctica.

Reglas innegociables:

- Las credenciales de OpenObserve solo pueden existir como secretos de entorno o fichero montado; nunca en código, tests, fixtures, README ni logs.
- Las API keys de cliente se almacenan solo como hash SHA-256 con comparación en tiempo constante.
- En producción MUST NOT permitirse `services: ["*"]`; todos los servicios deben listarse explícitamente.
- Las keys frontend o públicas en la práctica MUST tener alcance mínimo, límites estrictos, respuesta reducida y permisos explícitos definidos en la spec aplicable.
- Las reglas concretas de lectura frontend, ventanas temporales, límites de resultados y streams autorizados pertenecen a la spec de feature y MUST respetar el principio de mínimo privilegio.
- Campos sensibles conocidos MUST enmascararse como `***redacted***` antes de enviar a OpenObserve.
- La API MUST registrar métricas de redacción y truncado.
- La API MUST NOT registrar payloads completos de cliente, API keys, credenciales O2, headers `Authorization`, cookies ni secretos.
- La política de PII, IPs y datos personales directos MUST quedar definida en la spec aplicable antes de implementar ingesta o consulta de logs.
- Si aparecen requisitos legales/compliance adicionales, esta constitución MUST revisarse antes de implementar cambios.

### IV. OpenObserve como único almacenamiento de logs

OpenObserve MUST ser el único almacenamiento de logs de aplicación en el MVP. La API es stateless respecto a datos permanentes de logs.

Reglas:

- El gateway MUST usar endpoints oficiales de OpenObserve para ingesta y búsqueda.
- La organización, estrategia de streams, tipo de stream, agrupación, garantías de entrega, reintentos, duplicados, retención y escalado pertenecen a la spec de feature.
- Cualquier almacenamiento persistente adicional de logs o colas durables requiere spec explícita y revisión constitucional si cambia la garantía de almacenamiento del proyecto.

### V. API contract-first y compatibilidad versionada

Todo endpoint público MUST estar documentado antes de implementarse y versionado bajo `/api/v1`.

Los endpoints públicos concretos se definen en la spec de feature y contratos asociados.

Reglas de contrato:

- Errores MUST usar el formato estándar `{ error: { code, message, details }, request_id }`.
- `request_id` MUST estar presente en respuestas normales y de error.
- La construcción SQL contra O2 MUST usar allowlists, escape correcto y límites. Concatenar input de usuario directamente está prohibido.
- Cambios incompatibles de request/response requieren nueva versión de API o enmienda explícita.

### VI. Operabilidad observable

El gateway MUST ser observable por sí mismo desde el MVP.

Reglas:

- Logs internos estructurados con Pino.
- Logs internos a stdout/stderr para Coolify.
- Logs internos también deben enviarse al destino de observabilidad definido por la spec, evitando bucles recursivos.
- Las métricas operativas MUST exponerse en formato Prometheus cuando la spec incluya endpoint de métricas.
- La spec MUST definir métricas mínimas, healthchecks, readiness y documentación operativa.

### VII. Calidad y testabilidad no negociables

El código MUST ser testeable por diseño. Ninguna feature se considera terminada sin tests automatizados relevantes.

Quality gates obligatorios:

- `npm ci`
- `npm run lint`
- `npm run format:check`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

Cobertura mínima:

- 85% statements global.
- 85% branches global.
- 90% statements en módulos de dominio (`auth`, `normalization`, `redaction`, `query`, `limits`).
- 100% de criterios de aceptación de la spec aprobada cubiertos por unit, integration o E2E.

Tests obligatorios:

- Unitarios para normalización, redacción, autorización, límites, cursores, hash de keys y construcción SQL.
- Integración HTTP para endpoints públicos.
- E2E con API + OpenObserve real o contenedor equivalente.
- Tests negativos para credenciales inválidas, permisos insuficientes, payloads grandes, restricciones frontend definidas en la spec y configuraciones prohibidas en producción.

Se prohíbe saltarse tests por flakiness sin abrir tarea explícita de corrección. Mocks solo se permiten en unit tests; integración/E2E debe probar contratos reales o adaptadores de frontera.

### VIII. Validación runtime de datos y configuración

Todo dato externo, no confiable o procedente de una frontera del sistema MUST validarse en runtime antes de ser usado por la lógica de negocio. TypeScript solo valida en compilación y MUST NOT considerarse suficiente para confiar en datos recibidos en ejecución.

Se consideran datos externos o no confiables, como mínimo:

- `body`, `query`, `params` y `headers` recibidos por controladores HTTP.
- Payloads recibidos desde APIs externas, incluyendo respuestas de OpenObserve.
- Webhooks.
- Mensajes de colas, eventos, jobs o sistemas externos.
- Variables de entorno.
- Ficheros subidos por usuarios.
- Datos recuperados de `localStorage`, cookies o almacenamiento del cliente.
- Salidas generadas por LLMs.
- Cualquier dato serializado/deserializado desde JSON.
- Cualquier entrada recibida desde CLI, scripts, cron jobs o integraciones externas.

Ninguna feature puede asumir que los datos recibidos son válidos solo porque TypeScript compile correctamente.

Zod es la librería estándar obligatoria del proyecto para:

- Validar datos en runtime.
- Parsear datos externos hacia estructuras internas seguras.
- Definir contratos explícitos de entrada y salida.
- Inferir tipos TypeScript a partir de esquemas de validación.
- Validar configuración y variables de entorno al arrancar.

Siempre que sea posible, los tipos TypeScript MUST inferirse desde esquemas Zod mediante `z.infer<typeof Schema>`.

No se permite duplicar manualmente tipos TypeScript que representen la misma estructura ya definida en un esquema Zod, salvo causa justificada y documentada en el código.

Ejemplo normativo:

```ts
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;
```

La validación debe hacerse en la frontera del sistema y producir un tipo interno seguro. La lógica de dominio y aplicación SHOULD recibir datos ya parseados, no objetos crudos de `Request`, `process.env`, JSON externo o respuestas HTTP sin validar.

Reglas específicas para `.env` y configuración:

- La aplicación MUST validar todas las variables de entorno al arrancar mediante un schema Zod único de configuración.
- Si falta una variable obligatoria o tiene formato inválido, la aplicación MUST fallar rápido durante bootstrap, antes de aceptar tráfico.
- `process.env` MUST leerse solo dentro del módulo de configuración. El resto del código MUST depender de configuración tipada e inyectada.
- `.env` y cualquier fichero con secretos reales MUST NOT commitearse.
- `.env.example` MUST existir, mantenerse actualizado y contener solo nombres de variables y valores ficticios no sensibles.
- Los secretos reales MUST inyectarse mediante Coolify, variables de entorno seguras o ficheros montados como secretos.
- Los valores numéricos, booleanos, listas y JSON de entorno MUST parsearse explícitamente; no se permite usar strings crudos cuando el dominio espera otro tipo.
- La configuración de API keys MUST validarse con Zod antes de crear cualquier key en memoria.
- La configuración validada MUST ser inmutable durante la vida del proceso, salvo que una feature futura defina explícitamente recarga segura.

### IX. Logging, trazabilidad y depuración

El proyecto MUST tener un estándar único, transversal y obligatorio para la emisión de logs. Todas las features, módulos, servicios, controladores, guards, interceptors, filters, jobs, workers, scripts e integraciones MUST usar el sistema de logging definido por el proyecto. No se permite que cada módulo implemente su propia estrategia de logging.

Tecnologías oficiales:

- Servidor/NestJS: Pino 10.3.1 integrado mediante `nestjs-pino` 4.6.1 o provider propio compatible con `LoggerService`.
- Cliente/frontend o snippets browser entregados por el proyecto: `loglevel` 1.9.2.
- API común de aplicación: wrapper propio obligatorio.

Wrapper obligatorio:

- El proyecto MUST exponer una abstracción propia de logging, por ejemplo `AppLogger`, `ApplicationLogger` o `SharedLogger`.
- El código de aplicación MUST emitir logs exclusivamente a través de esta abstracción.
- La lógica de negocio MUST NOT depender directamente de Pino, `nestjs-pino`, `loglevel` ni APIs concretas del transporte de logs.
- La abstracción MUST permitir inyectar logger falso o en memoria en tests unitarios.
- La abstracción MUST soportar contexto estructurado por request, módulo y caso de uso.

Uso prohibido:

- `console.log`
- `console.debug`
- `console.info`
- `console.warn`
- `console.error`
- Instancias directas de Pino/loglevel dentro de lógica de dominio o aplicación.

Excepción limitada: scripts CLI como `npm run keygen` pueden escribir resultados intencionados a stdout/stderr mediante un helper explícito de salida de CLI. Esa salida no se considera logging de aplicación y MUST NOT incluir secretos salvo que el objetivo explícito del comando sea generar y mostrar un secreto nuevo al operador.

Niveles oficiales y semántica:

| Nivel | Uso permitido |
|---|---|
| `trace` | Diagnóstico muy detallado y temporal. MUST estar desactivado en producción salvo investigación puntual. |
| `debug` | Información útil para desarrollo o diagnóstico controlado. No debe contener payloads completos ni secretos. |
| `info` | Eventos normales de ciclo de vida, arranque, parada, configuración no sensible, aceptación de lotes y operaciones esperadas. |
| `warn` | Situaciones recuperables o anómalas: truncado de contexto, rate limit, reintentos, configuración degradada, O2 lento. |
| `error` | Fallos de operación que impiden completar una acción: error O2 tras reintentos, payload imposible de procesar, fallo de worker. |
| `fatal` | Fallo no recuperable que obliga a terminar el proceso o impide arrancar correctamente. |

Reglas de estructura:

- Todo log de servidor MUST ser JSON estructurado.
- Todo log MUST incluir, cuando aplique: `request_id`, `service`, `env`, `module`, `operation`, `level`, `message` y timestamp generado por el logger.
- Logs relacionados con trazas MUST conservar `trace_id` y `span_id` si están disponibles.
- Logs de ingesta MUST registrar conteos y metadatos, no payloads completos.
- Errores MUST registrarse con objeto de error serializable (`type`, `message`, `stack` si procede, `code`, `cause` cuando exista) sin filtrar secretos.
- Los logs internos del gateway MUST enviarse a stdout/stderr y al stream `log_gateway` en OpenObserve.
- Si falla el envío de logs internos a OpenObserve, MUST registrarse de forma local sin reintentos recursivos infinitos.

Reglas de privacidad:

- Antes de emitir cualquier log, el wrapper MUST aplicar redacción de campos sensibles conocidos.
- Nunca se deben loguear API keys, credenciales O2, headers `Authorization`, cookies, passwords, tokens, secretos, payloads completos ni ficheros subidos completos.
- Los campos redactados MUST contabilizarse mediante métrica.
- Los mensajes de log deben ser estables y no deben interpolar valores sensibles dentro del texto libre; los valores variables deben ir en campos estructurados ya filtrados.

Reglas de observabilidad y depuración:

- Cada request HTTP MUST tener un `request_id` único.
- Si el cliente envía `request_id`, la API puede conservarlo solo tras validarlo; si falta, MUST generarlo.
- Los workers y jobs MUST propagar `request_id` o generar un identificador de job correlacionable.
- Reintentos contra OpenObserve MUST emitir logs `warn` con intento, backoff y destino, sin payload completo.
- Fallos definitivos contra OpenObserve MUST emitir `error` y métrica asociada.
- El nivel de log runtime MUST controlarse con `LOG_LEVEL`, validado por Zod.

## Technology Constraints

### Runtime, packaging and deployment

- El proyecto MUST usar npm y `package-lock.json`.
- El Dockerfile MUST ser multi-stage.
- La imagen runtime MUST ejecutarse como usuario no root.
- La imagen runtime MUST contener solo dependencias de producción y artefactos compilados.
- El puerto por defecto es `3000`.
- Configuración por variables de entorno o fichero montado; no se permite configuración mutable en base de datos para el MVP.
- Despliegue objetivo: Coolify con TLS en reverse proxy y healthcheck definido por la spec aplicable.

### TypeScript and code style

- `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` MUST estar activos.
- No se permite `any` salvo justificación local y comentario `// intentional-any:` con motivo concreto.
- No se permite `console.*` en código de aplicación; ESLint MUST bloquearlo salvo excepciones explícitas para helpers CLI.
- No se permiten imports circulares.
- No se permite lógica de negocio en decorators, interceptors o pipes si dificulta test unitario.
- DTOs externos e internos MUST diferenciarse cuando el contrato HTTP no coincida exactamente con el modelo normalizado.

### Data and configuration

- La fuente de verdad de API keys, entornos aceptados y límites operativos MUST definirse en la spec de feature y validarse por configuración.
- Cualquier nuevo campo raíz de log debe añadirse al esquema y tests; el tratamiento de campos desconocidos debe estar definido en la spec.
- El tratamiento de payloads excesivos, truncado y rechazo parcial debe estar definido en la spec.
- Toda configuración MUST estar representada por un tipo inferido desde Zod.
- El módulo de configuración MUST ser la única frontera autorizada para leer `.env`/`process.env`.
- `.env.example` MUST actualizarse en el mismo cambio que añada, renombre o elimine variables.

### Accessibility and interface policy

El MVP no incluye interfaz gráfica propia. Los requisitos de accesibilidad aplican a documentación, ejemplos y cualquier UI futura.

Si se añade panel de administración o UI futura:

- MUST cumplir WCAG 2.2 AA.
- MUST separar presentación de lógica de gestión.
- MUST ser usable con teclado.
- MUST incluir labels accesibles, estados de foco visibles y contraste suficiente.
- MUST evitar exponer secretos completos en pantalla.

## Development Workflow

### Spec Kit authority

Esta constitución es el marco innegociable del proyecto. `Historias.md`, futuras specs, planes y tareas MUST respetarla.

Orden de autoridad:

1. `.specify/memory/constitution.md`
2. `spec.md` de la feature aprobada
3. `plan.md`
4. `tasks.md`
5. Implementación

`Historias.md` es fuente de requisitos de cliente y trazabilidad. Antes de planificar o implementar, su contenido MUST reconciliarse en la spec aprobada; si hay conflicto tras esa reconciliación, prevalece la spec aprobada salvo contradicción constitucional.

Si un artefacto posterior contradice esta constitución, el artefacto posterior MUST modificarse o debe proponerse una enmienda formal a la constitución.

### Required artifacts before implementation

Antes de implementar, cada feature significativa MUST tener:

- Spec con historias de usuario y criterios de aceptación.
- Plan técnico con arquitectura, dependencias y riesgos.
- Tareas pequeñas y verificables.
- Contratos HTTP o schemas cuando cambien endpoints/payloads.
- Estrategia de tests asociada a criterios de aceptación.

### Review gates

Toda revisión MUST comprobar:

- Cumplimiento de stack/versiones.
- Separación controllers/application/domain/infrastructure.
- Ausencia de secretos en código/logs/docs.
- Cobertura y tests de casos negativos.
- Validación Zod en todas las fronteras nuevas o modificadas.
- Ausencia de lecturas directas de `process.env` fuera del módulo de configuración.
- Actualización de `.env.example` cuando cambie la configuración.
- Uso exclusivo del wrapper de logging y ausencia de `console.*`/Pino/loglevel directo en lógica de negocio.
- Niveles de log correctos, campos estructurados y redacción de datos sensibles.
- No regresión de restricciones frontend.
- SQL seguro contra O2.
- Métricas y logs internos para nuevos caminos críticos.
- Actualización de README, `.env.example` y colección Postman cuando cambie el contrato.

## Governance

Esta constitución supersede prácticas informales, preferencias personales y decisiones posteriores que la contradigan.

### Amendment process

Una enmienda requiere:

1. Describir el cambio y motivo.
2. Enumerar artefactos afectados (`Historias.md`, specs, plan, tareas, código, tests, docs).
3. Definir plan de migración si afecta contratos, datos, seguridad o despliegue.
4. Incrementar versión de constitución.
5. Actualizar fecha `Last Amended`.

### Versioning policy

- MAJOR: cambios que modifican principios, stack obligatorio, seguridad, almacenamiento o garantías de entrega.
- MINOR: nuevos principios o restricciones compatibles.
- PATCH: aclaraciones, correcciones editoriales o versiones de dependencias compatibles que no cambian decisiones.

### Compliance

Cada plan y PR MUST incluir una comprobación explícita de cumplimiento constitucional. Si se acepta una excepción temporal, MUST documentarse con fecha de caducidad y tarea de remediación.

**Version**: 1.2.0 | **Ratified**: 2026-06-06 | **Last Amended**: 2026-06-06
