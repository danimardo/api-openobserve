# Research — Log Gateway API (Phase 0)

**Feature**: `001-log-gateway-api` | **Date**: 2026-06-06

Este documento consolida las decisiones técnicas de diseño. El stack y las versiones están **fijados por `constitution.md` v1.2.0** y no se investigan alternativas de stack. No quedan `NEEDS CLARIFICATION`: el spec fue clarificado (formato de token, enum `source`, entrega por lotes) y la Technical Context se deriva por completo de la constitución.

> Nota operativa (CLAUDE.md): la sintaxis exacta de API (NestJS 11, Zod 4, `@nestjs/throttler` 6, `nestjs-pino` 4, prom-client 15) se verificará con Context7 durante la implementación. Aquí se fija el **enfoque**, no el código.

---

## D1 — Validación runtime con Zod en las fronteras NestJS

- **Decisión**: Un `ZodValidationPipe` propio convierte body/query/headers crudos en tipos internos seguros (`z.infer`). Los DTOs externos se definen como esquemas Zod en `domain/schemas`; los controllers reciben datos ya parseados. La configuración y las API keys también se validan con Zod en `infrastructure/config`.
- **Rationale**: Principio VIII obliga a validar toda frontera con Zod y a inferir tipos desde el esquema (sin duplicar tipos). Un pipe único centraliza el contrato de error de validación (`400 validation_error`).
- **Alternativas**: `class-validator`/`class-transformer` (descartado: la constitución fija Zod como librería estándar y prohíbe duplicar tipos); validación manual (descartado: no testeable ni consistente).

## D2 — Autenticación por API key con token compuesto

- **Decisión**: `ApiKeyAuthGuard` extrae `Authorization: Bearer <key_id>.<secret>`, separa por el **primer** `.`, busca la key por `key_id` en el mapa cargado en config y, si existe, compara `sha256(secret)` con `secret_hash` usando `crypto.timingSafeEqual`. Sin cabecera / formato sin `.` / `key_id` inexistente / secreto no coincidente → `401`. Un segundo guard (o el mismo) aplica `scope` y `service` para `403` en consulta; en ingesta el rechazo es por registro.
- **Rationale**: Clarificación de spec (sesión 2026-06-06) + principio III (hash SHA-256, comparación en tiempo constante). `key_id` permite lookup O(1) y comparación contra un candidato concreto, además de identificar la key en logs/métricas sin exponer el secreto.
- **Alternativas**: token = solo secreto con lookup por hash (descartado por la clarificación: dificulta identificación y rotación); JWT (descartado: añade complejidad y no aporta al modelo stateless por configuración).

## D3 — Rate limiting por API key

- **Decisión**: `@nestjs/throttler` 6.5.0 con un generador de tracker basado en `key_id` (no en IP), límite = `RATE_LIMIT_RPS` con ventana de 1 s. Al superarlo → `429 rate_limited` e incremento de `log_gateway_rate_limited_total`. Endpoints públicos sin key (`/health`, `/health/ready`, `/metrics`) quedan exentos.
- **Rationale**: FR-030 exige límite por API key; throttler es la dependencia fijada por la constitución. El tracker por `key_id` aísla el consumo entre aplicaciones.
- **Alternativas**: rate limit por IP (descartado: el aislamiento es por aplicación/key, no por origen; server-to-server comparte IPs); algoritmo token-bucket propio (descartado: reinventa la dependencia ya fijada).

## D4 — Ingesta asíncrona: cola en memoria + worker por lotes

- **Decisión**: `infrastructure/queue` mantiene una cola acotada (`QUEUE_MAX_ITEMS`). La ingesta valida/normaliza/redacta de forma síncrona, encola por `service`/stream y responde `202` (FR-007). Un worker agrupa por stream y entrega a O2 en lotes con flush por `DELIVERY_BATCH_MAX` (500) **o** `DELIVERY_FLUSH_MS` (1000), lo que ocurra antes; reintentos/backoff por lote (`RETRY_ATTEMPTS`, `RETRY_BACKOFF_MS`). Cola llena → `429 rate_limited` (FR-008). Métricas: `queue_depth`, `o2_delivery_failed_total`, `o2_delivery_retried_total`.
- **Rationale**: Clarificación de entrega por lotes + objetivos O6 (resiliencia) y best-effort (D9, D10). Agrupar por stream encaja con el endpoint `_multi`/`_json` de O2 y reduce llamadas.
- **Alternativas**: entrega síncrona por request (descartado: acopla la latencia del cliente a O2, rompe fire-and-forget); un envío por registro (descartado por throughput); cola durable/DLQ (fuera de alcance MVP, requeriría enmienda del principio IV).

## D5 — Cliente OpenObserve (ingesta y consulta)

- **Decisión**: `infrastructure/openobserve` encapsula axios 1.17 (vía `@nestjs/axios`) con HTTP Basic (`O2_AUTH_USER`/`O2_AUTH_PASSWORD`). Ingesta usa el endpoint de bulk JSON por stream (`_json`/`_multi`) en la organización `O2_ORG`; consulta usa `_search` con SQL. Las respuestas de O2 se **validan con Zod** antes de usarse (principio VIII: respuestas externas son no confiables). Fallo de consulta síncrona → `502 openobserve_error`; readiness comprueba conectividad/credenciales.
- **Rationale**: Principio IV (endpoints oficiales O2), Assumptions (Basic auth, única organización, stream por servicio creado en primera ingesta). OpenObserve OSS 0.90.3 es la versión objetivo validada.
- **Alternativas**: SDK no oficial (descartado: no fijado, riesgo de versión); conexión directa expuesta al cliente (descartado: viola O2 — no exponer credenciales).

## D6 — Construcción de SQL segura para consulta

- **Decisión**: `domain/query/sql-builder` construye el SQL con **allowlist** para `service`/`level`/`env`/`sort` y campos consultables fijos; `from`/`to`/`limit` se acotan; `q`/`trace_id`/`request_id` se escapan correctamente (sin concatenación directa). El conjunto de columnas y operadores es cerrado.
- **Rationale**: Principio V + FR-016 + CA11/SC-005 (no inyección SQL). La lógica es pura y testeable con fuzzing de valores maliciosos.
- **Alternativas**: query builder genérico (descartado: O2 usa SQL propio; mantener allowlist explícita es más auditable); parametrización nativa (no garantizada por el endpoint `_search`, por eso allowlist + escape).

## D7 — Paginación con cursor opaco

- **Decisión**: `next_cursor` es un token opaco (base64url de `{ sort, last_timestamp, last_event_id/tiebreaker, filtros_hash }`) que codifica la posición estable según `sort`. La consulta no devuelve `total` por defecto; `include_total=true` solo para keys backend/internas y documentado como costoso.
- **Rationale**: FR-017, SC-013, US2 (paginación estable). El cursor opaco evita exponer offsets y desacopla el contrato de la implementación O2.
- **Alternativas**: paginación por offset/`LIMIT OFFSET` (descartado: inestable ante ingestas concurrentes y costoso); devolver `total` siempre (descartado por coste en O2).

## D8 — Normalización y redacción

- **Decisión**: `domain/normalization` normaliza `level` (minúsculas + mapa `warning→warn`, `err→error`, `critical→fatal`; desconocido → `invalid_level`), rellena `_timestamp` (recepción si falta; ISO-8601 ↔ int64 µs según O2), aplana `context` por puntos hasta `CONTEXT_MAX_DEPTH`, mueve campos raíz no reconocidos a `context.extra`, elimina/convierte no serializables y marca `context_truncated` al exceder profundidad o `MAX_FIELDS_PER_RECORD`. `source` se normaliza al enum `backend|frontend`; valor desconocido → `unknown`. `domain/redaction` enmascara campos sensibles/PII conocida por nombre (`***redacted***`) e incrementa `redacted_fields_total`. Sin detección avanzada de PII en texto libre.
- **Rationale**: FR-006/010/011/012/013/014, clarificaciones de `source` y truncado, principio III (redacción) y política de PII del spec.
- **Alternativas**: detección de PII por contenido/regex en `message` (fuera de alcance MVP, declarado en spec).

## D9 — Logging estructurado con wrapper propio

- **Decisión**: `infrastructure/logging` expone `AppLogger` (wrapper sobre Pino 10 vía `nestjs-pino` 4) como única API de logging de la aplicación. Soporta contexto por request (`request_id`, `service`, `env`, `module`, `operation`), redacta campos sensibles antes de emitir, escribe a stdout/stderr y envía al stream `log_gateway` en O2 **sin reintento recursivo** si falla. El dominio recibe un logger inyectable (falso en unit tests).
- **Rationale**: Principio IX (wrapper obligatorio, prohibición de `console.*`/Pino directo en dominio, niveles, redacción, anti-bucles). `LOG_LEVEL` validado por Zod.
- **Alternativas**: Pino directo en cada módulo (prohibido por constitución); `console.*` (prohibido y bloqueado por ESLint).

## D10 — Métricas Prometheus

- **Decisión**: `infrastructure/metrics` registra con prom-client 15 las métricas mínimas de FR-029 (counters: accepted/rejected/o2_delivery_failed/o2_delivery_retried/rate_limited/redacted_fields/context_truncated; gauge: queue_depth; histogram: request_duration_seconds). `GET /api/v1/metrics` expone el registro en formato Prometheus, público y sin key. Un interceptor mide la duración de request.
- **Rationale**: Principio VI + FR-029 + SC-009 + US11.
- **Alternativas**: métricas push (descartado: el modelo es scrape Prometheus, documentado con `scrape_config`).

## D11 — Configuración y carga de API keys (fail-fast)

- **Decisión**: `infrastructure/config` es la **única** frontera que lee `process.env`. Un schema Zod único valida todas las variables al arrancar y falla rápido si falta obligatoria o tiene formato inválido (FR-037). Las API keys se cargan de `API_KEYS_JSON` o `API_KEYS_FILE`, se validan con Zod, se rechaza `services:["*"]` en producción y se prohíbe que keys frontend autoricen streams backend o `log_gateway`. La config validada es inmutable durante la vida del proceso.
- **Rationale**: Principio VIII (config Zod, fail-fast, `process.env` aislado, inmutable) + FR-023/024/025/037.
- **Alternativas**: lectura dispersa de `process.env` (prohibida); recarga en caliente (no contemplada en MVP).

## D12 — Límites de tamaño, gzip y content-type

- **Decisión**: Middleware/pipe aplica `INGEST_MAX_BODY_MB` midiendo **body comprimido y JSON descomprimido** (FR-031); descomprime `Content-Encoding: gzip` en `/logs/batch`; `INGEST_MAX_BATCH` (→`413`), `MAX_FIELDS_PER_RECORD`, `LOG_MESSAGE_MAX_CHARS`, `CONTEXT_MAX_DEPTH`, `CONTEXT_VALUE_MAX_CHARS`. Content-Type no soportado → `415`. CORS restringido por `allowed_origins` de la key y/o `CORS_ALLOWED_ORIGINS`.
- **Rationale**: FR-031/032/033, US6, US10, CHK011.
- **Alternativas**: límite solo sobre body comprimido (descartado: permite bombas de descompresión).

## D13 — Empaquetado y despliegue

- **Decisión**: Dockerfile multi-stage (build con devDeps → runtime con solo deps de producción), usuario no root, base `node:24.16.0-bookworm-slim`, puerto 3000, healthcheck a `/api/v1/health/ready`. `.env.example` sin secretos; README con variables, ejecución local, despliegue Coolify y ejemplo `scrape_config`; colección Postman 2.1.0; snippets backend/frontend.
- **Rationale**: Technology Constraints + FR-039 + US13.
- **Alternativas**: imagen single-stage (descartado: arrastra devDeps); ejecutar como root (prohibido).

---

## Resumen de cierre

- **NEEDS CLARIFICATION pendientes**: ninguno.
- **Riesgos**: pérdida de logs en cola ante caída (aceptado, best-effort, una réplica); dependencia dura de O2 para readiness y consulta; versiones de stack muy recientes (verificar sintaxis con Context7 al implementar).
- **Listo para Phase 1 (diseño y contratos)**.
