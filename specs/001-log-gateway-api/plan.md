# Implementation Plan: API de logging centralizado sobre OpenObserve (Log Gateway)

**Branch**: `001-log-gateway-api` | **Date**: 2026-06-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-log-gateway-api/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

El gateway es una API NestJS que recibe logs de aplicaciones propias (backend/frontend) mediante API keys propias y los reenvía a OpenObserve sin exponer credenciales internas, con un stream por servicio. Responsabilidades núcleo: (1) **ingesta** validada/normalizada/redactada con cola en memoria y entrega por lotes best-effort; (2) **consulta** filtrada segura con SQL por allowlist y cursor opaco; (3) **aislamiento** por API key (`services`+`scopes`); más rate limit, métricas Prometheus, health/readiness y despliegue reproducible en Coolify.

Enfoque técnico (fijado por `constitution.md`): NestJS 11 + TypeScript 6 (`strict`), Node 24, validación runtime con Zod 4 en todas las fronteras, logging estructurado con Pino 10 vía wrapper propio, métricas con prom-client 15, rate limit con `@nestjs/throttler` 6, cliente HTTP a O2 con axios 1.17. Arquitectura por capas estricta (controllers / application / domain / infrastructure) con dominio puro testeable sin levantar NestJS ni O2.

## Technical Context

**Language/Version**: TypeScript 6.0.3 (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) sobre Node.js 24 LTS (Docker target `node:24.16.0-bookworm-slim`).

**Primary Dependencies**: NestJS core/common/platform-express 11.1.24, `@nestjs/config` 4.0.4, `@nestjs/axios` 4.0.1 + axios 1.17.0, `@nestjs/throttler` 6.5.0, Zod 4.4.3, Pino 10.3.1 + `nestjs-pino` 4.6.1, prom-client 15.1.3, helmet 8.2.0, uuid 14.0.0, reflect-metadata 0.2.2, rxjs 7.8.2. CLI/keygen usa el runtime Node + helper de salida. Snippets frontend usan `loglevel` 1.9.2.

**Storage**: OpenObserve OSS 0.90.3 es el **único** almacenamiento de logs (principio IV). La API es stateless: no hay base de datos. Estado efímero: cola de entrega en memoria (`QUEUE_MAX_ITEMS`). API keys cargadas desde configuración (`API_KEYS_JSON`/`API_KEYS_FILE`), inmutables en runtime.

**Testing**: Jest 30.4.2 con `@swc/jest` 0.2.39 (unit + integración), `@nestjs/testing` 11.1.24, supertest 7.2.2 para HTTP. E2E contra OpenObserve real/contenedor equivalente. Cobertura mínima: 85% global, 90% en dominio (`auth`, `normalization`, `redaction`, `query`, `limits`), 100% de CA cubiertos.

**Target Platform**: Servidor Linux containerizado (Coolify con TLS en reverse proxy). Puerto por defecto 3000. Imagen multi-stage, usuario no root, solo dependencias de producción.

**Project Type**: Web service (API HTTP REST única bajo `/api/v1`).

**Performance Goals**: Best-effort, **sin SLO numérico de latencia/throughput en el MVP** (declarado fuera de alcance en spec, CHK033). Objetivo operativo: la respuesta de ingesta es `202` inmediata al encolar; el throughput hacia O2 se modula con entrega por lotes (`DELIVERY_BATCH_MAX=500`, `DELIVERY_FLUSH_MS=1000`).

**Constraints**: Una sola réplica en MVP (D10); pérdida posible de logs encolados en reinicio/caída (best-effort, sin cola durable/DLQ). Rate limit por key `RATE_LIMIT_RPS=100`. Límites de payload/lote/campos configurables (FR-031, FR-038). Sin lectura directa de `process.env` fuera del módulo de configuración. Sin `console.*` en código de aplicación.

**Scale/Scope**: 13 historias de usuario (P1–P3), 39 requisitos funcionales (FR-001..FR-039), 22 criterios globales (CA1–CA22), 14 success criteria (SC-001..SC-014). 6 grupos de endpoints públicos bajo `/api/v1`. Cola en memoria hasta 10.000 items por defecto.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitución v1.2.0. Evaluación inicial (pre-research):

| Principio | Gate | Estado | Cómo lo cumple el diseño |
|---|---|---|---|
| I. Stack cerrado y versionado | Versiones exactas, npm + lockfile, sin prerelease | PASS | Technical Context usa las versiones exactas de la tabla constitucional; `package-lock.json` fijado; sin alpha/beta/next. |
| II. Arquitectura por capas | controllers/application/domain/infrastructure; dominio testeable sin Nest/O2 | PASS | Estructura de carpetas (abajo) separa transporte, casos de uso, dominio puro y adaptadores. Controllers no llaman a O2, no leen secretos ni construyen SQL. |
| III. Seguridad y privacidad | Secretos solo en entorno; keys solo hash + compare tiempo constante; no `["*"]` en prod; redacción; sin payloads/secretos en logs | PASS | Config con Zod; `secret_hash` SHA-256 + `crypto.timingSafeEqual`; validación de `["*"]` en bootstrap; dominio `redaction`; logger redacta. |
| IV. OpenObserve único almacenamiento | Endpoints oficiales O2; stateless | PASS | `infrastructure/openobserve` usa `_json`/`_multi` (ingesta) y `_search` (consulta). Sin DB. |
| V. API contract-first y versionada | Documentar antes de implementar; `/api/v1`; error estándar; `request_id`; SQL por allowlist | PASS | `contracts/openapi.yaml` define todos los endpoints antes de implementar; filtro de error global; interceptor de `request_id`; dominio `query/sql-builder` con allowlist + escape. |
| VI. Operabilidad observable | Pino estructurado; stdout/stderr + stream `log_gateway`; métricas Prometheus; health/readiness | PASS | `infrastructure/logging` (AppLogger) + `infrastructure/metrics`; endpoints `/health`, `/health/ready`, `/metrics`. |
| VII. Calidad y testabilidad | Quality gates; cobertura; tests unit/integ/e2e/negativos | PASS | Jest + supertest; dominio puro 90%; e2e con O2 contenedor; tests negativos por CA. |
| VIII. Validación runtime (Zod) | Validar toda frontera; tipos inferidos de Zod; config Zod fail-fast | PASS | Schemas Zod para `LogEvent`, query params, config y API keys; `z.infer` para tipos; bootstrap valida env. |
| IX. Logging, trazabilidad, depuración | Wrapper único; niveles correctos; redacción; `request_id`; sin bucles recursivos | PASS | `AppLogger` obligatorio; niveles mapeados a semántica; `request_id` por request/worker; envío a `log_gateway` sin reintento recursivo. |

**Resultado del gate inicial**: PASS — sin violaciones. No se requiere Complexity Tracking.

**Re-check post-diseño (Phase 1)**: PASS — los artefactos generados (`research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`) mantienen la separación de capas, validación Zod en todas las fronteras, SQL por allowlist, formato de error estándar con `request_id`, redacción y observabilidad. No aparecen nuevas dependencias ni desviaciones respecto al stack constitucional.

## Project Structure

### Documentation (this feature)

```text
specs/001-log-gateway-api/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── openapi.yaml      # Contrato HTTP de todos los endpoints /api/v1
│   └── README.md         # Notas de uso del contrato y errores
├── checklists/
│   ├── requirements.md   # Calidad del spec (ya existente)
│   └── spec-readiness.md # Gate de readiness (ya existente)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── main.ts                          # bootstrap NestJS, helmet, fail-fast de config
├── app.module.ts                    # composición de módulos
├── controllers/                     # solo HTTP: parseo ya validado, status, DTOs salida
│   ├── ingest.controller.ts          # POST /api/v1/logs, POST /api/v1/logs/batch
│   ├── query.controller.ts           # GET /api/v1/logs
│   ├── services.controller.ts        # GET /api/v1/services
│   ├── health.controller.ts          # GET /api/v1/health, /health/ready
│   └── metrics.controller.ts         # GET /api/v1/metrics
├── application/
│   └── services/                    # casos de uso
│       ├── ingest.service.ts
│       ├── query.service.ts
│       ├── list-services.service.ts
│       ├── health.service.ts
│       └── metrics.service.ts
├── domain/                          # reglas puras, sin dependencias de framework
│   ├── schemas/                      # esquemas Zod + tipos inferidos (LogEvent, query, config, api-key)
│   ├── normalization/                # level, timestamp, context flatten, extra
│   ├── redaction/                    # enmascarado de campos sensibles/PII conocida
│   ├── authorization/                # services/scopes, frontend policy, ["*"]
│   ├── limits/                       # tamaños, batch, campos, longitudes
│   ├── query/                        # sql-builder por allowlist + escape, cursor opaco
│   └── errors/                       # tipos de error de dominio y códigos
├── infrastructure/
│   ├── openobserve/                  # cliente O2 (_json/_multi/_search), traducción de contratos
│   ├── config/                       # única frontera de process.env; validación Zod env + api keys
│   ├── queue/                        # cola en memoria acotada + worker de entrega por lotes/reintentos
│   ├── metrics/                      # registro prom-client y contadores/histogramas/gauges
│   └── logging/                      # AppLogger (wrapper Pino), request context, envío a log_gateway
└── common/                          # transporte transversal
    ├── guards/                       # ApiKeyAuthGuard (Bearer key_id.secret), scope/service guard
    ├── interceptors/                 # request_id, duración (métrica)
    ├── filters/                      # filtro de error → { error:{code,message,details}, request_id }
    ├── pipes/                        # ZodValidationPipe
    └── middleware/                   # gzip/content-type/body-size, CORS por key

scripts/
└── keygen.ts                        # npm run keygen → key_id + secreto + hash SHA-256

test/
├── unit/                            # dominio: normalization, redaction, auth, limits, cursor, sql-builder, hash
├── integration/                     # HTTP por endpoint con supertest (mocks solo aquí permitidos en unit)
└── e2e/                             # API + OpenObserve real/contenedor

docs/
└── snippets/
    ├── backend/                     # snippet best-effort backend (buffer/flush/timeout)
    └── frontend/                    # snippet fetch keepalive + Authorization (loglevel)

postman/
└── log-gateway.postman_collection.json   # colección schema 2.1.0

Dockerfile                           # multi-stage, usuario no root, solo deps producción
.env.example                         # nombres de variables + valores ficticios (sin secretos)
README.md                            # config, ejecución local, despliegue Coolify, scrape_config
```

**Structure Decision**: Proyecto único de web service NestJS (no monorepo frontend/backend; el frontend solo recibe snippets de referencia bajo `docs/snippets`, no es una app del repo). La estructura materializa la separación de capas obligatoria del principio II: `controllers` (HTTP), `application/services` (casos de uso), `domain` (reglas puras testeables aisladas) e `infrastructure` (adaptadores: O2, config, queue, metrics, logging). `common/` aloja guards, interceptors, filters y pipes de transporte sin lógica de negocio compleja, para no dificultar el test unitario (principio II y reglas de estilo).

## Complexity Tracking

> No aplica: el Constitution Check inicial pasó sin violaciones, por lo que no hay desviaciones que justificar.
