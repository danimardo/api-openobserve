---
description: "Task list for feature 001-log-gateway-api"
---

# Tasks: API de logging centralizado sobre OpenObserve (Log Gateway)

**Input**: Design documents from `/specs/001-log-gateway-api/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml, quickstart.md, constitution.md v1.2.0

**Tests**: INCLUIDOS de forma obligatoria. La constitución (principio VII) exige tests automatizados con cobertura mínima (85% global, 90% dominio) y 100% de criterios de aceptación cubiertos (SC-002, CA22). No son opcionales en este proyecto.

**Organization**: Tareas agrupadas por historia de usuario (US1..US13) en orden de prioridad (P1 → P2 → P3) para implementación y prueba independientes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (ficheros distintos, sin dependencias incompletas)
- **[Story]**: Historia de usuario asociada (US1..US13)
- Rutas exactas según la estructura de `plan.md` (proyecto único NestJS).

## Path Conventions

Proyecto único: `src/`, `test/`, `scripts/`, `docs/`, `postman/` en la raíz. Capas: `src/controllers`, `src/application/services`, `src/domain/*`, `src/infrastructure/*`, `src/common/*`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialización del proyecto y herramientas de calidad.

- [ ] T001 Crear estructura de carpetas del proyecto según `plan.md` (src/controllers, src/application/services, src/domain/{schemas,normalization,redaction,authorization,limits,query,errors}, src/infrastructure/{openobserve,config,queue,metrics,logging}, src/common/{guards,interceptors,filters,pipes,middleware}, test/{unit,integration,e2e}, scripts/, docs/snippets/{backend,frontend}, postman/)
- [ ] T002 Inicializar `package.json` con las dependencias EXACTAS de la tabla constitucional (NestJS 11.1.24, @nestjs/config 4.0.4, @nestjs/axios 4.0.1, axios 1.17.0, @nestjs/throttler 6.5.0, zod 4.4.3, pino 10.3.1, nestjs-pino 4.6.1, prom-client 15.1.3, helmet 8.2.0, uuid 14.0.0, reflect-metadata 0.2.2, rxjs 7.8.2; dev: jest 30.4.2, @swc/core 1.15.40, @swc/jest 0.2.39, @nestjs/testing 11.1.24, supertest 7.2.2, eslint 10.4.1, typescript-eslint 8.60.1, prettier 3.8.3, typescript 6.0.3, @types/node 24.13.1, @types/jest 30.0.0) y scripts (`start:dev`, `build`, `test`, `test:e2e`, `lint`, `format:check`, `keygen`); fijar `package-lock.json` con `npm install`
- [ ] T003 [P] Configurar `tsconfig.json` con `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (constitución, TypeScript and code style)
- [ ] T004 [P] Configurar ESLint (`eslint.config.*`) + `typescript-eslint` con regla que bloquea `console.*` en código de aplicación, y Prettier (`.prettierrc`) + `format:check`
- [ ] T005 [P] Configurar Jest con `@swc/jest` para unit/integración y configuración e2e separada, con umbrales de cobertura (85% global statements/branches; 90% statements en `src/domain/{authorization,normalization,redaction,query,limits}`)
- [ ] T006 [P] Crear `.env.example` con todas las variables (`PORT`, `NODE_ENV`, `O2_URL`, `O2_ORG`, `O2_AUTH_USER`, `O2_AUTH_PASSWORD`, `API_KEYS_JSON`, `API_KEYS_FILE`, `ALLOWED_ENVS`, `INGEST_MAX_BATCH`, `INGEST_MAX_BODY_MB`, `LOG_MESSAGE_MAX_CHARS`, `CONTEXT_MAX_DEPTH`, `CONTEXT_VALUE_MAX_CHARS`, `MAX_FIELDS_PER_RECORD`, `QUEUE_MAX_ITEMS`, `RETRY_ATTEMPTS`, `RETRY_BACKOFF_MS`, `DELIVERY_BATCH_MAX`, `DELIVERY_FLUSH_MS`, `RATE_LIMIT_RPS`, `CORS_ALLOWED_ORIGINS`, `LOG_LEVEL`, `METRICS_ENABLED`) con valores ficticios y sin secretos

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura núcleo compartida por TODAS las historias. **⚠️ Ninguna historia puede empezar hasta completar esta fase.**

- [ ] T007 [P] Definir esquemas Zod base y tipos inferidos (`z.infer`) en `src/domain/schemas/` (`log-event.schema.ts` entrada/normalizado, `query.schema.ts`, `api-key.schema.ts`, `error.schema.ts`) según `data-model.md`
- [ ] T008 [P] Definir tipos/códigos de error de dominio en `src/domain/errors/` (mapa `code`→HTTP de `data-model.md` §6)
- [ ] T009 Implementar módulo de configuración en `src/infrastructure/config/` como única frontera de `process.env`: schema Zod de entorno con parseo de números/booleanos/listas/JSON, defaults (FR-038) y **fail-fast** en bootstrap (FR-037)
- [ ] T010 Implementar carga y validación de API keys en `src/infrastructure/config/api-keys.ts`: parseo desde `API_KEYS_JSON`/`API_KEYS_FILE`, validación Zod, rechazo de `services:["*"]` en producción (FR-023) y de keys frontend que autoricen streams backend o `log_gateway` (FR-024); config inmutable
- [ ] T011 [P] Implementar wrapper de logging `AppLogger` en `src/infrastructure/logging/` sobre Pino 10 + `nestjs-pino`: contexto estructurado (`request_id`, `service`, `env`, `module`, `operation`), redacción en emisión, salida a stdout/stderr (principio IX); inyectable/falso para tests
- [ ] T012 [P] Implementar registro de métricas Prometheus en `src/infrastructure/metrics/` con prom-client: las métricas mínimas de FR-029 (counters, gauge `queue_depth`, histogram `request_duration_seconds`)
- [ ] T013 [P] Implementar `ZodValidationPipe` en `src/common/pipes/` que convierte body/query/headers crudos en tipos internos y emite `400 validation_error` (principio VIII)
- [ ] T014 [P] Implementar interceptor de `request_id` en `src/common/interceptors/` (conserva el del cliente solo tras validarlo; si falta/ inválido lo genera) y filtro global de error en `src/common/filters/` con formato `{ error:{code,message,details}, request_id }` (FR-035)
- [ ] T015 [P] Implementar interceptor de duración en `src/common/interceptors/` que alimenta `log_gateway_request_duration_seconds`
- [ ] T016 Implementar cliente base OpenObserve en `src/infrastructure/openobserve/`: axios con HTTP Basic (`O2_AUTH_USER`/`O2_AUTH_PASSWORD`), organización `O2_ORG`, validación Zod de respuestas (principio VIII, D5)
- [ ] T017 Implementar `ApiKeyAuthGuard` en `src/common/guards/`: parseo de `Authorization: Bearer <key_id>.<secret>`, separación por el primer `.`, lookup por `key_id`, comparación `sha256(secret)` vs `secret_hash` con `crypto.timingSafeEqual` → `401` en fallo (FR-020, FR-025)
- [ ] T018 Implementar servicio de autorización en `src/domain/authorization/`: reglas de `scopes` (`read`/`write`) y `services`, política frontend (`client_type`, `read_policy`) — lógica pura (FR-021, FR-022)
- [ ] T019 Configurar `@nestjs/throttler` con tracker por `key_id` (no IP) y límite `RATE_LIMIT_RPS` en `src/common/` (cableado; comportamiento `429` se prueba en US10) (FR-030)
- [ ] T020 Implementar `src/main.ts` y `src/app.module.ts`: bootstrap NestJS con helmet, pipes/filters/interceptors globales, puerto 3000 y fail-fast de configuración
- [ ] T021 [P] Test unitario de carga/validación de config y API keys en `test/unit/config.spec.ts` (incluye `["*"]` prod inválido y restricción frontend) (FR-023, FR-024, FR-037)
- [ ] T022 [P] Test unitario del `AppLogger` (redacción y contexto, sin secretos) en `test/unit/logging.spec.ts` (principio IX)

**Checkpoint**: Fundación lista — las historias pueden comenzar.

---

## Phase 3: User Story 1 - Ingestar logs sin exponer credenciales (Priority: P1) 🎯 MVP

**Goal**: Aceptar `POST /api/v1/logs` (objeto o array) con key `write`, validar/normalizar/redactar, encolar y entregar al stream correcto de OpenObserve, respondiendo `202`.

**Independent Test**: Con key `write` válida para `payments_api`, enviar un evento válido a `POST /api/v1/logs` y comprobar `202` (`accepted:1, rejected:0`) y que aparece en el stream `payments_api` (quickstart V1).

### Tests for User Story 1 ⚠️ (escribir primero, deben fallar)

- [ ] T023 [P] [US1] Test de integración HTTP de `POST /api/v1/logs` (objeto y array, `202`, conteos) en `test/integration/ingest.spec.ts` (FR-001, FR-003)
- [ ] T024 [P] [US1] Test unitario de normalización de `_timestamp` (relleno por recepción, ISO-8601↔µs) en `test/unit/normalization-timestamp.spec.ts` (FR-006)
- [ ] T025 [P] [US1] Test unitario del worker de entrega por lotes (agrupación por stream, flush por tamaño/intervalo, reintentos) en `test/unit/queue-worker.spec.ts` (FR-007)
- [ ] T026 [US1] Test E2E ingesta → aparición en stream OpenObserve en `test/e2e/ingest.e2e-spec.ts` (CA1, CA8)

### Implementation for User Story 1

- [ ] T027 [P] [US1] Implementar normalización núcleo en `src/domain/normalization/` (relleno/conversión de `_timestamp`, normalización de `level` con mapa de equivalencias e `invalid_level`) (FR-006, FR-011)
- [ ] T028 [P] [US1] Implementar redacción de campos sensibles conocidos en `src/domain/redaction/` (`***redacted***` + métrica) (FR-014)
- [ ] T029 [US1] Implementar cola en memoria acotada en `src/infrastructure/queue/queue.ts` (`QUEUE_MAX_ITEMS`, gauge `queue_depth`) (FR-007, FR-008)
- [ ] T030 [US1] Implementar worker de entrega en `src/infrastructure/queue/delivery.worker.ts`: agrupar por stream, flush por `DELIVERY_BATCH_MAX`/`DELIVERY_FLUSH_MS`, reintentos/backoff por lote, métricas de fallo/reintento (FR-007, clarificación)
- [ ] T031 [US1] Implementar path de ingesta en cliente O2 `src/infrastructure/openobserve/ingest.ts` usando `_json`/`_multi`, agrupando por `service`/stream (FR-005)
- [ ] T032 [US1] Implementar `IngestService` en `src/application/services/ingest.service.ts`: validar→normalizar→redactar→encolar y construir respuesta de conteos (FR-003)
- [ ] T033 [US1] Implementar `IngestController` `POST /api/v1/logs` en `src/controllers/ingest.controller.ts` (acepta objeto o array; guard `write`) (FR-001)
- [ ] T034 [US1] Registrar logs operativos de ingesta (conteos/metadatos, sin payloads) vía `AppLogger` (principio IX, FR-034)

**Checkpoint**: US1 funcional e independientemente testeable (MVP).

---

## Phase 4: User Story 2 - Consultar logs por servicio con filtros seguros (Priority: P1)

**Goal**: `GET /api/v1/logs` con key `read`, filtros validados, SQL por allowlist sin inyección y cursor opaco.

**Independent Test**: Con key `read` para un servicio, consultar con filtros y comprobar `items` + `next_cursor`, allowlist respetada y que entradas maliciosas no alteran la consulta (quickstart V8, V10).

### Tests for User Story 2 ⚠️

- [ ] T035 [P] [US2] Test de integración HTTP de `GET /api/v1/logs` (filtros, `200`, `next_cursor`, falta `service`→`400`) en `test/integration/query.spec.ts` (FR-015)
- [ ] T036 [P] [US2] Test unitario de no inyección SQL (fuzzing de `q`/`trace_id`/`request_id`) en `test/unit/sql-builder.spec.ts` (FR-016, CA11)
- [ ] T037 [P] [US2] Test unitario de codificación/decodificación estable del cursor opaco en `test/unit/cursor.spec.ts` (FR-017)
- [ ] T038 [US2] Test E2E de paginación estable contra OpenObserve en `test/e2e/query.e2e-spec.ts` (CA9, CA10)

### Implementation for User Story 2

- [ ] T039 [P] [US2] Implementar constructor SQL seguro en `src/domain/query/sql-builder.ts` (allowlist `service`/`level`/`env`/`sort`, escape de `q`/`trace_id`/`request_id`, acotado de `limit`) (FR-016)
- [ ] T040 [P] [US2] Implementar cursor opaco en `src/domain/query/cursor.ts` (codifica posición estable según `sort`) (FR-017)
- [ ] T041 [US2] Implementar path de búsqueda en cliente O2 `src/infrastructure/openobserve/search.ts` (`_search`), con `502 openobserve_error` ante fallo (FR-019)
- [ ] T042 [US2] Implementar `QueryService` en `src/application/services/query.service.ts` (filtros, defaults, `items`/`next_cursor`/`request_id`, sin `total` por defecto) (FR-015, FR-017)
- [ ] T043 [US2] Implementar `QueryController` `GET /api/v1/logs` en `src/controllers/query.controller.ts` (guard `read`; `service` obligatorio → `400`) (FR-015)

**Checkpoint**: US1 y US2 funcionan independientemente.

---

## Phase 5: User Story 3 - Aislamiento por aplicación mediante API keys (Priority: P1)

**Goal**: Aplicar `services`+`scopes` por key: `write` solo escribe sus servicios, `read` solo consulta los suyos; `["*"]` solo lectura y prohibido en producción.

**Independent Test**: Cargar keys con distintos `services`/`scopes` y verificar autorizaciones (quickstart V11, V12).

### Tests for User Story 3 ⚠️

- [ ] T044 [P] [US3] Test unitario de autorización (scope/service, `["*"]` solo lectura) en `test/unit/authorization.spec.ts` (FR-022, FR-023)
- [ ] T045 [P] [US3] Test de integración negativo: `401` key inválida, `403` falta de scope, rechazo por registro de `service` no autorizado en ingesta, `403` en consulta no autorizada, en `test/integration/authz.spec.ts` (CA5, CA6, CA7)

### Implementation for User Story 3

- [ ] T046 [US3] Integrar autorización en `IngestService` (rechazo por registro de `service` no autorizado, FR-021) y en `QueryController`/`QueryService` (`403` por falta de scope o acceso a `service`, FR-021)
- [ ] T047 [US3] Aplicar validación de arranque que impide `services:["*"]` en producción y `["*"]` solo para lectura (refuerza T010) (FR-023)

**Checkpoint**: P1 completo (ingesta + consulta + aislamiento).

---

## Phase 6: User Story 7 - Normalización y redacción de eventos (Priority: P2)

**Goal**: Normalización completa (context aplanado, extra, truncado) y redacción/PII por nombre de campo antes de O2.

**Independent Test**: Enviar eventos con level variado, sin timestamp, context profundo y campos sensibles, verificando normalización, marcas de truncado y `***redacted***` (quickstart V14).

### Tests for User Story 7 ⚠️

- [ ] T048 [P] [US7] Test unitario de aplanado de `context`, `context.extra`, truncado y `context_truncated` en `test/unit/normalization-context.spec.ts` (FR-012, FR-013)
- [ ] T049 [P] [US7] Test unitario de redacción de PII conocida y valores no serializables en `test/unit/redaction.spec.ts` (FR-014, FR-012)

### Implementation for User Story 7

- [ ] T050 [US7] Ampliar `src/domain/normalization/` con aplanado por puntos hasta `CONTEXT_MAX_DEPTH`, mover campos raíz no reconocidos a `context.extra`, eliminar/convertir no serializables y marcar `context_truncated` (FR-012, FR-013)
- [ ] T051 [US7] Ampliar `src/domain/redaction/` con la lista completa de campos sensibles/PII conocida y emisión de `log_gateway_redacted_fields_total`/`log_gateway_context_truncated_total` (FR-014)
- [ ] T052 [US7] Normalizar `source` al enum `backend|frontend` con `unknown` para valores fuera del enum en `src/domain/normalization/` (FR-010, clarificación)

**Checkpoint**: Calidad de datos hacia O2 garantizada.

---

## Phase 7: User Story 6 - Envío por lotes con compresión y aceptación parcial (Priority: P2)

**Goal**: `POST /api/v1/logs/batch` (array obligatorio, gzip opcional) con conteos y errores por índice y límites.

**Independent Test**: Enviar array mixto a `/logs/batch` con y sin gzip y verificar `202` con conteos/errores; rechazo `413`/`400` (quickstart V5).

### Tests for User Story 6 ⚠️

- [ ] T053 [P] [US6] Test de integración de `/logs/batch` (mixto, gzip, no-array→`400`, sin válidos→`400`) en `test/integration/batch.spec.ts` (FR-002, FR-003, FR-004)

### Implementation for User Story 6

- [ ] T054 [US6] Implementar middleware de descompresión gzip y medición de tamaño comprimido+descomprimido en `src/common/middleware/` (FR-031)
- [ ] T055 [US6] Implementar endpoint `POST /api/v1/logs/batch` en `src/controllers/ingest.controller.ts` (array obligatorio, `Content-Encoding: gzip`) (FR-002)
- [ ] T056 [US6] Implementar aceptación parcial con `errors[]` por índice en `IngestService` (`202`; sin válidos→`400` con `details`) (FR-003, FR-004)

**Checkpoint**: Ingesta de alto volumen disponible.

---

## Phase 8: User Story 5 - Lectura desde frontend con alcance reducido (Priority: P2)

**Goal**: Keys frontend: solo su `service`/`env`, respuesta reducida sin campos sensibles, `q` prohibido, ventana ≤7d y `limit` ≤500 con marcas de recorte.

**Independent Test**: Con key frontend `read`, verificar respuesta reducida, prohibición de `q`, `range_truncated`/`limit_truncated` y `403` en service/env ajeno (quickstart V13).

### Tests for User Story 5 ⚠️

- [ ] T057 [P] [US5] Test de integración de restricciones frontend en `test/integration/frontend-read.spec.ts` (reducida, `q` prohibido, recortes, `403`) (FR-018, CA20)

### Implementation for User Story 5

- [ ] T058 [P] [US5] Implementar perfil de respuesta reducida `frontend_reduced` (allowlist de campos, eliminación de sensibles/conocidos en `context`) en `src/domain/query/response-profile.ts` (FR-018)
- [ ] T059 [US5] Aplicar `read_policy` en `QueryService`: prohibición de `q`, recorte de ventana >7d (`range_truncated`), recorte de `limit` >500 (`limit_truncated`), restricción a `service`/`env` autorizados (FR-018)

**Checkpoint**: Lectura frontend segura.

---

## Phase 9: User Story 10 - Límites y rate limiting anti-abuso (Priority: P2)

**Goal**: Rate limit por key y límites de payload/lote/campos/longitudes con `429`/`413`/`415`.

**Independent Test**: Superar rate limit y límites de tamaño y verificar códigos `429`/`413`/`415` (quickstart V6, V7).

### Tests for User Story 10 ⚠️

- [ ] T060 [P] [US10] Test unitario de límites en `src/domain/limits/` en `test/unit/limits.spec.ts` (longitud `message`, campos, longitud valores context) (FR-031)
- [ ] T061 [P] [US10] Test de integración de `429` (rate limit y cola llena), `413` (body/batch), `415` (content-type) en `test/integration/limits.spec.ts` (FR-030, FR-031, FR-032, CA12)

### Implementation for User Story 10

- [ ] T062 [P] [US10] Implementar reglas de límites puras en `src/domain/limits/` (`LOG_MESSAGE_MAX_CHARS`, `MAX_FIELDS_PER_RECORD`, `CONTEXT_VALUE_MAX_CHARS`, `INGEST_MAX_BATCH`) (FR-031)
- [ ] T063 [US10] Aplicar límites en ingesta (`413 payload_too_large` por body/lote; rechazo de `message` largo) y `415` por content-type no soportado (FR-031, FR-032)
- [ ] T064 [US10] Verificar `429 rate_limited` por throttler (T019) y por cola llena (`QUEUE_MAX_ITEMS`), con incremento de `log_gateway_rate_limited_total` (FR-008, FR-030)
- [ ] T065 [US10] Implementar CORS restringido por `allowed_origins` de la key y `CORS_ALLOWED_ORIGINS` en `src/common/middleware/` (FR-033)

**Checkpoint**: Protección de disponibilidad activa.

---

## Phase 10: User Story 9 - Salud y readiness para despliegue (Priority: P2)

**Goal**: `/health` (liveness) y `/health/ready` (readiness contra O2) públicos.

**Independent Test**: `/health` siempre `200`; `/health/ready` `200` con O2 ok y `503` si no (quickstart V16).

### Tests for User Story 9 ⚠️

- [ ] T066 [P] [US9] Test de integración de `/health` (`200`) y `/health/ready` (`200`/`503`) en `test/integration/health.spec.ts` (FR-028, CA13)

### Implementation for User Story 9

- [ ] T067 [US9] Implementar `HealthService` en `src/application/services/health.service.ts` (readiness comprueba conectividad/credenciales O2) (FR-028)
- [ ] T068 [US9] Implementar `HealthController` `GET /api/v1/health` y `GET /api/v1/health/ready` públicos (sin API key) en `src/controllers/health.controller.ts` (FR-028)

**Checkpoint**: Operable por Coolify.

---

## Phase 11: User Story 11 - Observabilidad de la propia API (Priority: P2)

**Goal**: `/metrics` Prometheus y logs internos al stream `log_gateway` sin secretos ni bucles recursivos.

**Independent Test**: `/metrics` expone métricas mínimas; provocar eventos cambia contadores; logs internos sin secretos (quickstart V17).

### Tests for User Story 11 ⚠️

- [ ] T069 [P] [US11] Test de integración de `GET /api/v1/metrics` (formato Prometheus, métricas mínimas) en `test/integration/metrics.spec.ts` (FR-029, CA18)
- [ ] T070 [P] [US11] Test unitario del sink a `log_gateway` sin reintento recursivo ante fallo en `test/unit/log-gateway-sink.spec.ts` (FR-034)

### Implementation for User Story 11

- [ ] T071 [US11] Implementar `MetricsController` `GET /api/v1/metrics` público en `src/controllers/metrics.controller.ts` y `MetricsService` que expone el registro (FR-029)
- [ ] T072 [US11] Implementar sink de logs internos al stream `log_gateway` en `src/infrastructure/logging/` (stdout/stderr + O2, sin secretos/payloads, sin bucles recursivos) (FR-034)
- [ ] T073 [US11] Cablear incrementos de contadores en los caminos críticos (accepted/rejected/o2 fallos/reintentos/rate_limited/redacted/truncated) (FR-029)

**Checkpoint**: Gateway auto-observable.

---

## Phase 12: User Story 12 - Gestión de API keys por configuración (Priority: P2)

**Goal**: Keys por configuración (sin BD) y herramienta `npm run keygen`.

**Independent Test**: Cargar keys desde JSON/fichero, ejecutar `keygen` y verificar secreto+hash y comparación en tiempo constante (quickstart preparación).

### Tests for User Story 12 ⚠️

- [ ] T074 [P] [US12] Test unitario de hashing SHA-256 y `timingSafeEqual` en `test/unit/key-hash.spec.ts` (FR-025)
- [ ] T075 [P] [US12] Test unitario del generador `keygen` (entropía, formato `key_id`+secreto+hash) en `test/unit/keygen.spec.ts` (FR-026)

### Implementation for User Story 12

- [ ] T076 [US12] Implementar `scripts/keygen.ts` (`npm run keygen`) que genera `key_id`, secreto de alta entropía y `secret_hash` SHA-256, con helper explícito de salida CLI (no `console.*` de aplicación) (FR-026, principio IX excepción)

**Checkpoint**: Operación de keys lista.

---

## Phase 13: User Story 8 - Descubrir capacidades de la API key (Priority: P3)

**Goal**: `GET /api/v1/services` devuelve solo lo autorizado de la key, sin secretos.

**Independent Test**: Llamar con distintas keys y verificar que devuelve solo lo suyo y nunca hashes/secretos (quickstart V15).

### Tests for User Story 8 ⚠️

- [ ] T077 [P] [US8] Test de integración de `GET /api/v1/services` (capacidades de la key; sin `secret_hash`; límites frontend) en `test/integration/services.spec.ts` (FR-027, CA19)

### Implementation for User Story 8

- [ ] T078 [US8] Implementar `ListServicesService` en `src/application/services/list-services.service.ts` (servicios/entornos/scopes/límites de la key actual) (FR-027)
- [ ] T079 [US8] Implementar `ServicesController` `GET /api/v1/services` en `src/controllers/services.controller.ts` (FR-027)

**Checkpoint**: Descubrimiento disponible.

---

## Phase 14: User Story 4 - Resiliencia del cliente ante fallos de logging (Priority: P2)

**Goal**: Snippets de referencia best-effort (buffer/flush/timeout) que no propagan errores a la app cliente.

**Independent Test**: Ejecutar los snippets simulando error/timeout y comprobar que no propagan excepciones y aplican buffer/flush/reintentos (quickstart V18).

### Tests for User Story 4 ⚠️

- [ ] T080 [P] [US4] Test del snippet backend simulando error/timeout (no propaga, aplica buffer/flush) en `test/unit/snippet-backend.spec.ts` (US4 AC1, AC3)

### Implementation for User Story 4

- [ ] T081 [P] [US4] Crear snippet backend de referencia en `docs/snippets/backend/` (buffer, flush periódico, timeout, captura de errores, envío a `/logs/batch`) (D24, US4)
- [ ] T082 [P] [US4] Crear snippet frontend de referencia en `docs/snippets/frontend/` (`fetch` con `keepalive` + `Authorization`, `loglevel`, fallo silencioso) (D26, US4)

**Checkpoint**: Integración cliente documentada.

---

## Phase 15: User Story 13 - Despliegue reproducible en Coolify (Priority: P3)

**Goal**: `Dockerfile`, `.env.example`, README y Postman para desplegar en Coolify.

**Independent Test**: Construir la imagen, arrancar con variables de ejemplo y comprobar healthcheck `/api/v1/health/ready` y README completo (quickstart Despliegue).

### Tests for User Story 13 ⚠️

- [ ] T083 [US13] Verificación de build de imagen y arranque con healthcheck en `test/e2e/deploy.e2e-spec.ts` (o script documentado) (CA17)

### Implementation for User Story 13

- [ ] T084 [P] [US13] Crear `Dockerfile` multi-stage (build con devDeps → runtime `node:24.16.0-bookworm-slim`, usuario no root, solo deps de producción, puerto 3000, healthcheck `/api/v1/health/ready`) (FR-039)
- [ ] T085 [P] [US13] Crear `postman/log-gateway.postman_collection.json` (schema 2.1.0) con todos los endpoints (FR-039, D25)
- [ ] T086 [US13] Redactar `README.md` (variables, ejecución local, despliegue Coolify, ejemplo `scrape_config` Prometheus, sin secretos) (FR-039)

**Checkpoint**: Desplegable de forma reproducible.

---

## Phase 16: Polish & Cross-Cutting Concerns

**Purpose**: Cierre transversal y verificación final.

- [ ] T087 [P] Revisar manejo de edge cases transversales (JSON malformado, multi-`service`, duplicados por reintento, request_id reenviado) según sección Edge Cases del spec
- [ ] T088 [P] Completar tests negativos exigidos por la constitución (credenciales inválidas, permisos insuficientes, payloads grandes, restricciones frontend, config prohibida en producción) (principio VII)
- [ ] T089 Verificar cobertura ≥85% global y ≥90% en dominio y que el 100% de CA1–CA22 están cubiertos (SC-002, CA22)
- [ ] T090 Ejecutar la validación de `quickstart.md` (V1–V18) de extremo a extremo
- [ ] T091 Ejecutar quality gates completos: `npm ci`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run test:e2e`, `npm run build` (principio VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup. **BLOQUEA** todas las historias.
- **User Stories (Phases 3–15)**: dependen de Foundational.
  - P1 primero: US1 (Phase 3) → US2 (Phase 4) → US3 (Phase 5).
  - P2/P3 después; pueden paralelizarse por equipos tras Foundational.
- **Polish (Phase 16)**: depende de las historias deseadas.

### User Story Dependencies

- **US1 (P1)**: solo Foundational. MVP.
- **US2 (P1)**: solo Foundational. Independiente de US1 (datos preexistentes en O2).
- **US3 (P1)**: refuerza autorización (T018) sobre US1/US2; sus tests son independientes.
- **US7 (P2)**: amplía normalización/redacción introducidas en US1 (T027/T028 → T050/T051).
- **US6 (P2)**: extiende ingesta de US1 (comparte `IngestService`/controller).
- **US5 (P2)**: extiende consulta de US2 (`read_policy`).
- **US10 (P2)**: límites/rate sobre ingesta y throttler (T019).
- **US9, US11, US12, US8, US4, US13**: en gran medida independientes tras Foundational.

### Within Each User Story

- Tests primero (deben fallar) → dominio puro → infraestructura → servicios → controllers → integración/logging.

### Parallel Opportunities

- Setup: T003–T006 en paralelo.
- Foundational: T007, T008, T011, T012, T013, T014, T015 en paralelo (ficheros distintos); T009→T010, T016/T017/T018 antes de T020.
- Tras Foundational: distintas historias por desarrolladores distintos.
- Dentro de una historia: tareas `[P]` (ficheros distintos) en paralelo.

---

## Parallel Example: User Story 1

```text
# Tests de US1 en paralelo (deben fallar primero):
Task: "T023 Test integración POST /api/v1/logs en test/integration/ingest.spec.ts"
Task: "T024 Test unitario normalización timestamp en test/unit/normalization-timestamp.spec.ts"
Task: "T025 Test unitario worker de entrega en test/unit/queue-worker.spec.ts"

# Dominio puro de US1 en paralelo:
Task: "T027 Normalización núcleo en src/domain/normalization/"
Task: "T028 Redacción de campos sensibles en src/domain/redaction/"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRÍTICO) → 3. Phase 3 US1 → 4. **VALIDAR US1 (quickstart V1)** → 5. Demo/deploy.

### Incremental Delivery (orden de prioridad)

P1 (US1 → US2 → US3) → P2 (US7, US6, US5, US10, US9, US11, US12, US4) → P3 (US8, US13) → Polish. Cada historia añade valor sin romper las anteriores; validar de forma independiente en cada checkpoint.

---

## Notes

- `[P]` = ficheros distintos, sin dependencias incompletas.
- La etiqueta `[Story]` traza cada tarea a su historia.
- Verificar que los tests fallan antes de implementar (constitución VII; mocks solo en unit).
- Commit tras cada tarea o grupo lógico.
- Cualquier cambio de comportamiento observable debe reflejarse en `spec.md` antes de cerrar la tarea (CLAUDE.md / constitución).
- El orden de fases (US7 antes que US6/US5) prioriza la calidad de datos del pipeline de ingesta tras el MVP P1.
