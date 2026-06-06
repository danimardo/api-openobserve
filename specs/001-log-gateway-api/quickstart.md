# Quickstart — Validación del Log Gateway API

**Feature**: `001-log-gateway-api` | **Date**: 2026-06-06

Guía para **validar** que la feature funciona de extremo a extremo. No contiene código de implementación (eso vive en `tasks.md` y la fase de implementación). Referencias: [`spec.md`](./spec.md), [`data-model.md`](./data-model.md), [`contracts/openapi.yaml`](./contracts/openapi.yaml).

## Prerrequisitos

- Node.js 24 LTS y npm 11.x (constitución I).
- OpenObserve OSS 0.90.3 accesible (local en contenedor o remoto) con una organización (`O2_ORG`) y credenciales Basic.
- Variables de entorno configuradas (ver `.env.example`). Mínimas obligatorias (FR-037): `O2_URL`, `O2_ORG`, `O2_AUTH_USER`, `O2_AUTH_PASSWORD`, y `API_KEYS_JSON` **o** `API_KEYS_FILE`.

## Preparación

1. Instalar dependencias exactas del lockfile:
   - `npm ci`
2. Generar una API key de prueba (FR-026):
   - `npm run keygen`
   - Produce `key_id` + secreto + `secret_hash`. Configura la key en `API_KEYS_JSON`/`API_KEYS_FILE` con su `secret_hash`, `services`, `scopes` y `client_type`. El token a usar en las pruebas es `<key_id>.<secret>`.
3. Arrancar en local:
   - `npm run start:dev`
   - Logs legibles en `.logs/app.log` y estructurados en `.logs/app.jsonl` (ignorados por Git).

## Escenarios de validación

> Sustituye `BASE=http://localhost:3000/api/v1`, `WRITE_KEY=<key_id>.<secret>` (scope `write`, servicio `payments_api`) y `READ_KEY=<key_id>.<secret>` (scope `read`).

### V1 — Ingesta válida (US1, CA1, CA8, SC-001)
- Acción: `POST $BASE/logs` con un `LogEvent` válido (`service=payments_api`) y `Authorization: Bearer $WRITE_KEY`.
- Esperado: `202` con `{ accepted: 1, rejected: 0 }`; el evento aparece en el stream `payments_api` de OpenObserve.

### V2 — Timestamp ausente (US1, FR-006)
- Acción: enviar un evento sin `_timestamp`.
- Esperado: `202`; el evento queda con la hora de recepción.

### V3 — Aislamiento por servicio en ingesta (US1, FR-021, CA7)
- Acción: con `WRITE_KEY` autorizada solo para `web_shop`, enviar un evento `service=payments_api`.
- Esperado: ese registro se rechaza (rechazo por registro), reflejado en `rejected`/`errors[]`.

### V4 — Objeto único o array (US1, FR-001)
- Acción: enviar (a) un objeto y (b) un array a `POST $BASE/logs`.
- Esperado: ambos formatos aceptados (`202`).

### V5 — Lote con aceptación parcial y gzip (US6, CA2, CA3, SC-003)
- Acción: `POST $BASE/logs/batch` con array mixto válido/ inválido, y repetir con `Content-Encoding: gzip`.
- Esperado: `202` con `accepted`/`rejected` y `errors[]` indexados; el gzip se descomprime y procesa igual.

### V6 — Límites de tamaño (US10, FR-031, CA12, SC-007)
- Acción: enviar body > `INGEST_MAX_BODY_MB`, lote > `INGEST_MAX_BATCH`, y un gzip cuyo JSON descomprimido supere el límite.
- Esperado: `413 payload_too_large` en los tres casos.

### V7 — Rate limit (US10, FR-030, CA12)
- Acción: superar `RATE_LIMIT_RPS` con la misma key.
- Esperado: `429 rate_limited`; se incrementa `log_gateway_rate_limited_total`.

### V8 — Consulta con filtros (US2, CA9, CA10, SC-013)
- Acción: `GET $BASE/logs?service=payments_api&level=error&from=...&to=...` con `Authorization: Bearer $READ_KEY`.
- Esperado: `200` con `items` filtrados y `next_cursor`; paginar con `cursor` devuelve la página siguiente de forma estable; sin `total` por defecto.

### V9 — Consulta sin service (US2, FR-015)
- Acción: `GET $BASE/logs` sin `service`.
- Esperado: `400 validation_error`.

### V10 — No inyección SQL (US2, CA11, SC-005)
- Acción: enviar valores maliciosos en `q`, `trace_id`, `request_id`.
- Esperado: el SQL se escapa; no se ejecuta inyección; la consulta responde de forma segura.

### V11 — Autorización por scope/servicio (US3, CA5, CA6, CA7, SC-012)
- Acción: (a) key inválida; (b) key `write` consultando; (c) key `read` escribiendo; (d) `service` no autorizado.
- Esperado: (a) `401`; (b) `403`; (c) `403`; (d) no se escribe ni consulta.

### V12 — `["*"]` en producción (US3, FR-023)
- Acción: arrancar con `NODE_ENV=production` y una key `services:["*"]`.
- Esperado: la configuración se considera inválida → fail-fast en bootstrap.

### V13 — Restricciones frontend (US5, FR-018, CA20, SC-006)
- Acción: con key `client_type=frontend`/`read`: consultar; usar `q`; pedir ventana > 7 días; pedir `limit > 500`; consultar `service`/`env` no autorizado.
- Esperado: respuesta reducida sin campos sensibles/conocidos; `q` rechazado; recorte con `range_truncated: true`; recorte a 500 con `limit_truncated: true`; `403` en service/env ajeno.

### V14 — Normalización y redacción (US7, CA21, SC-010)
- Acción: enviar `level: "WARNING"`, un `level` desconocido, `context` profundo, y campos sensibles (`password`, `token`, `iban`, `email`...).
- Esperado: `warn`; `invalid_level` para el desconocido; `context_truncated: true` al exceder límites; campos sensibles como `***redacted***`; `log_gateway_redacted_fields_total` incrementa.

### V15 — Descubrimiento (US8, FR-027, CA19, SC-008)
- Acción: `GET $BASE/services` con distintas keys.
- Esperado: solo servicios/entornos/scopes/límites de esa key; nunca `secret_hash` ni datos de otras keys.

### V16 — Salud y readiness (US9, FR-028, CA13, SC-011)
- Acción: `GET $BASE/health`; `GET $BASE/health/ready` con O2 disponible y no disponible.
- Esperado: `health` siempre `200`; `ready` `200` con O2 ok, `503` si no.

### V17 — Métricas (US11, FR-029, CA18, SC-009)
- Acción: generar tráfico y `GET $BASE/metrics`.
- Esperado: formato Prometheus con las métricas mínimas (accepted, rejected, o2 fallos/reintentos, queue_depth, rate_limited, duración, redacciones, truncados).

### V18 — Resiliencia del cliente (US4, CA — snippets)
- Acción: ejecutar los snippets de `docs/snippets` simulando error/timeout de red.
- Esperado: no se propaga excepción a la lógica de negocio; aplican buffer/flush/límite de reintentos; frontend usa `fetch` con `keepalive` + `Authorization`.

## Quality gates (constitución VII)

Antes de dar por terminada cualquier tarea, deben pasar:

- `npm ci`
- `npm run lint`
- `npm run format:check`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

Cobertura mínima: 85% global, 90% en dominio (`auth`, `normalization`, `redaction`, `query`, `limits`), 100% de CA cubiertos (SC-002, CA22).

## Despliegue (US13, FR-039)

- `docker build` de la imagen multi-stage; arrancar con variables de ejemplo; healthcheck a `/api/v1/health/ready`.
- README documenta variables, ejecución local, despliegue Coolify y ejemplo `scrape_config` de Prometheus, sin secretos reales.
