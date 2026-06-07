# Data Model — Log Gateway API (Phase 1)

**Feature**: `001-log-gateway-api` | **Date**: 2026-06-06

Modelo de datos del MVP. Todos los esquemas se implementan con **Zod 4** en `src/domain/schemas` y los tipos TypeScript se infieren con `z.infer` (principio VIII). Este documento describe campos, validaciones y transiciones; la sintaxis concreta de Zod vive en el código.

> Distinción de contratos: cuando el DTO externo (HTTP) no coincide con el modelo interno normalizado, se mantienen dos esquemas (entrada cruda vs. evento normalizado). Ver `LogEvent (entrada)` vs `LogEvent (normalizado)`.

---

## 1. LogEvent

Evento de log individual. Tiene dos formas: **entrada** (lo que envía el cliente) y **normalizado** (lo que se envía a OpenObserve).

### 1.1 LogEvent (entrada)

| Campo | Tipo | Obligatorio | Validación / Reglas | Origen |
|---|---|---|---|---|
| `_timestamp` | string ISO-8601 \| int64 (µs) | No | Si falta → hora de recepción. ISO-8601 ↔ µs según O2 (FR-006). | FR-006 |
| `service` | string | **Sí** | `^[a-z0-9_]{3,64}$` y autorizado por la key (FR-010, FR-022). | FR-010 |
| `env` | string | **Sí** | Dentro de `ALLOWED_ENVS` (FR-010). | FR-010 |
| `level` | string | **Sí** | Normalizable al enum (ver §1.3); desconocido → `invalid_level` (FR-011). | FR-011 |
| `message` | string | **Sí** | Longitud `1..LOG_MESSAGE_MAX_CHARS`; supera → rechazo (FR-010, US10). | FR-010 |
| `version` | string | No | Texto acotado; versión de la app emisora. | Key Entities |
| `event_id` | string | No | Solo trazabilidad; sin deduplicación estricta (FR-009). | FR-009 |
| `trace_id` | string | No | Se conserva; se escapa en consulta (FR-016). | FR-016 |
| `span_id` | string | No | Se conserva si está disponible. | FR-016 |
| `request_id` | string | No | Se conserva solo tras validarlo; si falta/ inválido → se genera (Edge Cases, FR-035). | FR-035 |
| `hostname` | string | No | Permitido (no es PII a redactar). | FR-036 |
| `source` | enum `backend\|frontend` | No | Valor fuera del enum → `unknown` (no rechaza). | FR-010 / Clarif. |
| `context` | object | No | Se aplana/recorta/redacta (ver §1.2). | FR-012..FR-014 |

Campos raíz **no reconocidos** → se mueven a `context.extra` (FR-012).

### 1.2 Tratamiento de `context`

- Aplanado por puntos hasta `CONTEXT_MAX_DEPTH` (FR-012).
- Si supera `CONTEXT_MAX_DEPTH` o el registro supera `MAX_FIELDS_PER_RECORD` → se recorta y se marca `context_truncated: true` (FR-013); el registro **no** se rechaza (salvo JSON inválido).
- Valores de cadena recortados a `CONTEXT_VALUE_MAX_CHARS`.
- Valores `undefined`/`NaN`/no serializables → se eliminan o convierten a string controlado (FR-012).
- Campos sensibles/PII conocida por nombre → `***redacted***` (FR-014), incrementa `redacted_fields_total`.

### 1.3 Normalización de `level`

Enum normalizado destino: `trace | debug | info | warn | error | fatal`.

| Entrada (case-insensitive) | Normalizado |
|---|---|
| `warning` | `warn` |
| `err` | `error` |
| `critical` | `fatal` |
| (cualquier valor del enum) | sí mismo en minúsculas |
| (otro) | rechazo `invalid_level` |

### 1.4 LogEvent (normalizado, hacia O2)

Mismos campos que la entrada, con: `_timestamp` siempre presente y en el formato O2; `level` normalizado; `source` ∈ `{backend, frontend, unknown}`; `context` aplanado/redactado; marca `context_truncated` cuando aplica; campos extra bajo `context.extra`.

---

## 2. API Key

Credencial de aplicación contra el gateway. Se carga desde configuración (`API_KEYS_JSON`/`API_KEYS_FILE`), nunca de una base de datos. El **token entrante** es `<key_id>.<secret>`.

| Campo | Tipo | Obligatorio | Validación / Reglas |
|---|---|---|---|
| `id` (`key_id`) | string | **Sí** | Identificador público; prefijo del token; usado para lookup O(1) y en logs/métricas. |
| `secret_hash` | string (SHA-256 hex) | **Sí** | Solo hash; comparación con `crypto.timingSafeEqual` (FR-025, principio III). Nunca se expone. |
| `services` | string[] | **Sí** | Streams autorizados. `["*"]` solo lectura/observabilidad y **prohibido en producción** (FR-023). |
| `scopes` | enum[] `read\|write` | **Sí** | `write` solo escribe sus servicios; `read` solo consulta los suyos (FR-022). |
| `allowed_origins` | string[] | No | CORS por key (FR-033). |
| `envs` | string[] | No | Entornos autorizados; subconjunto de `ALLOWED_ENVS`. |
| `client_type` | enum `frontend\|backend` | **Sí** | `frontend` no puede autorizar streams backend ni `log_gateway` (FR-024). |
| `read_policy` | object | Condicional | Para keys frontend (ver §2.1). |

### 2.1 `read_policy` (perfil de lectura)

| Campo | Tipo | Default frontend | Regla |
|---|---|---|---|
| `response_profile` | enum `full\|frontend_reduced` | `frontend_reduced` | Respuesta reducida sin campos sensibles/conocidos (FR-018). |
| `allow_q` | boolean | `false` | Frontend **no** puede usar `q` (FR-018, US5). |
| `max_query_window` | duración | `7d` | Ventana > 7 días → recorte + `range_truncated: true`. |
| `max_limit` | int | `500` | `limit` > 500 → recorte a 500 + `limit_truncated: true`. |

### 2.2 Reglas de validación de configuración de keys (bootstrap, Zod)

- Rechazar `services:["*"]` cuando `NODE_ENV=production` (FR-023).
- Rechazar keys `client_type=frontend` que listen streams backend o `log_gateway` (FR-024).
- `secret_hash` con formato SHA-256 válido.
- Fail-fast si la configuración de keys es inválida (FR-037).

---

## 3. Service / Stream

Aplicación emisora; un stream `logs` por `service` en una única organización OpenObserve (`O2_ORG`).

| Atributo | Regla |
|---|---|
| Nombre | `^[a-z0-9_]{3,64}$` (igual que `service`). |
| Creación | Automática en la primera ingesta (Assumptions). |
| Retención | Recomendación operativa por entorno (`prod=90d`, `staging=30d`, `dev=30d`, `test=7d`); no bloqueante; excepciones por stream configurables en O2. |
| `log_gateway` | Stream reservado para logs internos del gateway; no autorizable por keys frontend (FR-024, FR-034). |

---

## 4. Query / Resultado de consulta

### 4.1 Parámetros de consulta (`GET /api/v1/logs`)

| Param | Tipo | Default | Regla |
|---|---|---|---|
| `service` | string | — (**obligatorio**) | Falta → `400 validation_error` (FR-015). Autorizado por la key. |
| `from` | timestamp | `now-1h` | Ventana acotada; frontend máx 7 días. |
| `to` | timestamp | `now` | — |
| `level` | string(s) | — | Uno o varios niveles separados por coma; allowlist (FR-015/016). |
| `env` | string | — | Allowlist dentro de `ALLOWED_ENVS`. |
| `q` | string | — | Texto libre escapado; **prohibido** para frontend (FR-018). |
| `trace_id` | string | — | Escapado (FR-016). |
| `request_id` | string | — | Escapado (FR-016). |
| `limit` | int | `100` | Máx `1000` (no frontend) / `500` (frontend, con recorte). |
| `cursor` | string opaco | — | `next_cursor` de una respuesta previa (FR-017). |
| `sort` | enum `asc\|desc` | `desc` | Allowlist (FR-016). |
| `include_total` | boolean | `false` | Solo keys backend/internas; operación costosa (FR-017). |

### 4.2 Respuesta de consulta

| Campo | Tipo | Regla |
|---|---|---|
| `items` | LogEvent[] (reducido si frontend) | Resultados filtrados (FR-017). |
| `next_cursor` | string opaco \| null | Cursor estable (D7, FR-017). |
| `range_truncated` | boolean | `true` si se recortó la ventana (frontend) (FR-018). |
| `limit_truncated` | boolean | `true` si se recortó `limit` (frontend) (FR-018). |
| `request_id` | string | Presente siempre (FR-035). |
| `total` | int | **Ausente por defecto**; solo si `include_total=true` y key backend (FR-017). |

---

## 5. Cola de entrega (in-memory)

| Atributo | Regla |
|---|---|
| Capacidad | `QUEUE_MAX_ITEMS` (default 10000). Llena → `429 rate_limited` (FR-008). |
| Estructura | Eventos normalizados agrupados por stream/`service`. |
| Consumo | Worker entrega en lotes: flush por `DELIVERY_BATCH_MAX` (500) o `DELIVERY_FLUSH_MS` (1000), lo que ocurra antes (Clarif., FR-007). |
| Reintentos | `RETRY_ATTEMPTS` (3) con backoff `RETRY_BACKOFF_MS` (200,1000,5000) por lote. Tras agotar → `error` + `o2_delivery_failed_total`, sin romper al cliente. |
| Durabilidad | Ninguna: pérdida posible en reinicio/caída (best-effort, una réplica). Sin DLQ. |

---

## 6. Error (contrato transversal)

Formato estándar (principio V, FR-035): `{ "error": { "code": string, "message": string, "details"?: any }, "request_id": string }`.

| `code` | HTTP | Disparador |
|---|---|---|
| `validation_error` | 400 | JSON malformado / sin registros válidos / `service` ausente / batch no-array. |
| `unauthorized` | 401 | Sin Bearer / token sin `.` / `key_id` inexistente / secreto no coincide. |
| `forbidden` | 403 | Falta scope o acceso a `service` (consulta); frontend usando `q` o `service`/`env` no autorizado. |
| `payload_too_large` | 413 | Supera `INGEST_MAX_BODY_MB` (comprimido o descomprimido) o `INGEST_MAX_BATCH`. |
| `unsupported_media_type` | 415 | Content-Type no soportado. |
| `rate_limited` | 429 | Supera `RATE_LIMIT_RPS` o cola llena (`QUEUE_MAX_ITEMS`). |
| `openobserve_error` | 502 | Fallo de O2 en consulta síncrona. |
| (readiness) | 503 | O2 inaccesible o configuración inválida en `/health/ready`. |

Respuesta de ingesta exitosa (parcial o total): `202` con `{ accepted: int, rejected: int, errors?: [{ index, code, message }] }`.

---

## Trazabilidad

- LogEvent → FR-006, FR-009, FR-010..FR-014, FR-035, FR-036; US1, US7; CA1, CA8, CA21.
- API Key → FR-020..FR-026; US3, US8, US12; CA5, CA6, CA7, CA14, CA19.
- Service/Stream → FR-005, FR-024; Operational Defaults.
- Query → FR-015..FR-019; US2, US5; CA9, CA10, CA11, CA20.
- Cola de entrega → FR-007, FR-008; US4, US6; Edge Cases.
- Error → FR-003, FR-004, FR-019..FR-021, FR-030..FR-032, FR-035; CA12.
