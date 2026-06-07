# Contratos HTTP — Log Gateway API

Contrato **contract-first** (principio V de la constitución): definido antes de implementar. Fuente normativa: [`../spec.md`](../spec.md) y [`../../../.specify/memory/constitution.md`](../../../.specify/memory/constitution.md).

## Archivos

- `openapi.yaml` — Especificación OpenAPI 3.1 de todos los endpoints bajo `/api/v1`.

## Endpoints cubiertos

| Método y ruta real | Operación | Auth |
|---|---|---|
| `POST /api/v1/logs` | Ingesta (objeto o array) | Bearer key (`write`) |
| `POST /api/v1/logs/batch` | Ingesta por lotes (array, gzip opcional) | Bearer key (`write`) |
| `GET /api/v1/logs` | Consulta filtrada | Bearer key (`read`) |
| `GET /api/v1/services` | Capacidades de la key | Bearer key |
| `GET /api/v1/health` | Liveness | Público |
| `GET /api/v1/health/ready` | Readiness | Público |
| `GET /api/v1/metrics` | Métricas Prometheus | Público |

> Nota de OpenAPI: la consulta aparece en el YAML bajo la clave `/logs/query` por una limitación del formato (no se permiten dos operaciones con el mismo `path`+`method`; `POST /logs` ya ocupa ese path). **La ruta real implementada es `GET /api/v1/logs`**, tal como exige la spec (FR-015). Esta divergencia es solo de documentación.

## Convenciones de error

Todas las respuestas de error usan el formato estándar (FR-035):

```json
{ "error": { "code": "string", "message": "string", "details": {} }, "request_id": "string" }
```

Mapa de códigos → HTTP en [`../data-model.md`](../data-model.md) §6.

## Autenticación

`Authorization: Bearer <key_id>.<secret>`. El servidor separa por el primer `.`, localiza la key por `key_id` y compara `sha256(secret)` contra `secret_hash` en tiempo constante (FR-020, FR-025; clarificación 2026-06-06).

## Seguridad de consulta

El SQL contra OpenObserve se construye con allowlists (`service`/`level`/`env`/`sort`) y escape de `q`/`trace_id`/`request_id`; nunca por concatenación directa (FR-016, CA11).
