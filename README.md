# Log Gateway API

> API centralizada de logging para aplicaciones propias. Recibe logs de cualquier
> aplicación de tu empresa (backend o frontend), los valida, normaliza y reenvía a
> OpenObserve, sin que ninguna aplicación necesite conocer las credenciales internas
> de tu sistema de observabilidad.

---

## ¿Qué es esto y para qué sirve?

Imagina que tienes diez aplicaciones distintas en tu empresa: un API de pagos, una
tienda web, un servicio de autenticación, varias apps móviles... Todas ellas generan
eventos que necesitas registrar: errores, peticiones lentas, acciones de usuario,
alertas de negocio.

Sin una solución centralizada, cada aplicación tendría que:

- Saber la dirección y las credenciales de tu sistema de almacenamiento de logs.
- Implementar su propia lógica de reintentos, validación y formato.
- Exponer esas credenciales en su código o configuración.

**El Log Gateway resuelve exactamente ese problema.** Es un servicio intermediario
(un "gateway") que se coloca entre tus aplicaciones y OpenObserve. Las aplicaciones
solo necesitan una API key propia para enviar o consultar logs. El gateway se encarga
de todo lo demás: autenticar contra OpenObserve, enrutar cada log al stream correcto,
validar el formato, enmascarar datos sensibles y proteger el sistema de abusos.

```
  Tu app de pagos   ──► ┐
  Tu tienda web     ──► │                          ┌──────────────┐
  Tu app móvil      ──► ├──► Log Gateway API  ────►│  OpenObserve │
  Tu dashboard      ──► │    (este proyecto)        │  (privado)   │
  Cualquier app     ──► ┘                          └──────────────┘

  Cada app usa su propia API key.        El gateway usa sus propias
  Nunca ve credenciales de O2.           credenciales de OpenObserve.
```

---

## ¿Por qué no conectar directamente a OpenObserve?

OpenObserve utiliza usuario y contraseña para autenticar sus conexiones API. Si cada
aplicación conectara directamente, todas conocerían esas credenciales. Bastaría con
que una sola aplicación fuera comprometida para que un atacante tuviera acceso
completo a todos los logs de la empresa.

Con el gateway:

- **Las credenciales de OpenObserve solo viven en el gateway**, en un único lugar
  controlado.
- Cada aplicación tiene una **API key propia** que puedes revocar individualmente
  sin afectar al resto.
- Cada API key tiene **permisos acotados**: solo puede escribir/leer los streams
  que le corresponden. La app de pagos no puede ver los logs de la tienda web.
- Las keys de frontend (expuestas en el navegador) tienen restricciones adicionales
  automáticas: respuesta reducida, ventana temporal limitada, sin búsqueda de texto
  libre.

---

## ¿Qué hace exactamente el gateway?

### Recepción y validación de logs

Acepta eventos de log vía HTTP (`POST /api/v1/logs`). Cada evento puede incluir
nivel, mensaje, servicio, entorno, IDs de trazabilidad y cualquier contexto adicional
que quieras adjuntar. Los eventos inválidos se rechazan por registro — los válidos
del mismo lote se aceptan igualmente (aceptación parcial).

### Normalización automática

- Si el evento no incluye timestamp, el gateway añade la hora exacta de recepción.
- Los niveles de log se normalizan: `WARNING → warn`, `ERR → error`,
  `CRITICAL → fatal`, etc.
- El objeto `context` se aplana hasta una profundidad configurable.
- Los campos desconocidos en la raíz del evento se mueven automáticamente a
  `context.extra`.

### Redacción de datos sensibles

Antes de que ningún log llegue a OpenObserve, el gateway enmascara automáticamente
los valores de campos cuyo nombre sea sensible: `password`, `token`, `api_key`,
`email`, `iban`, `credit_card`, `dni`, `nif`, `phone`, etc. El valor se reemplaza
por `***redacted***`. Esto garantiza que datos personales o credenciales no
aparezcan nunca en el sistema de almacenamiento, aunque una aplicación los envíe
por error.

### Entrega asíncrona con reintentos

El gateway responde `202 Accepted` en cuanto encola el evento, sin esperar a que
llegue a OpenObserve. Un worker interno agrupa los eventos por servicio y los
entrega a OpenObserve en lotes, con reintentos automáticos y backoff exponencial
si OpenObserve no está disponible temporalmente. Esto hace que el logging nunca
bloquee ni ralentice la aplicación cliente.

### Consulta segura de logs

Expone `GET /api/v1/logs` para consultar logs de forma programática. La consulta
usa SQL construido internamente por allowlist — nunca se ejecuta texto libre del
usuario directamente. Los parámetros de búsqueda (`q`, `trace_id`, `request_id`,
etc.) se escapan correctamente para evitar inyección. El resultado se pagina con
un cursor opaco.

### Protección del sistema

- **Rate limiting** por API key: si una aplicación envía más del límite configurado,
  recibe `429` sin afectar a las demás.
- **Límites de tamaño**: payloads, lotes y campos con límites configurables.
- **CORS**: los orígenes permitidos se configuran globalmente y por API key.
- **Cola acotada**: si la cola interna llega al máximo, se rechaza nuevo tráfico
  en lugar de consumir memoria sin límite.

### Observabilidad propia

El gateway se observa a sí mismo: expone métricas Prometheus en
`GET /api/v1/metrics` (eventos aceptados, rechazados, fallos de entrega, profundidad
de cola, rate limits, campos redactados, etc.) y escribe sus propios logs al stream
`log_gateway` de OpenObserve — sin bucles recursivos y sin incluir secretos.

---

## Casos de uso típicos

| Quiero... | Cómo |
|---|---|
| Registrar errores de mi API de pagos | `POST /api/v1/logs` con una key `write` |
| Registrar eventos de UI desde el navegador | `POST /api/v1/logs/batch` con una key frontend |
| Buscar todos los errores de ayer de un servicio | `GET /api/v1/logs?service=payments_api&level=error&from=...&to=...` |
| Saber qué permisos tiene mi key | `GET /api/v1/services` |
| Monitorizar el gateway con Prometheus/Grafana | `GET /api/v1/metrics` |
| Verificar que el servicio está vivo | `GET /api/v1/health` |

---

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores obligatorios.

### Obligatorias

| Variable | Descripción | Ejemplo |
|---|---|---|
| `O2_URL` | URL base de OpenObserve | `http://openobserve:5080` |
| `O2_ORG` | Organización en OpenObserve | `default` |
| `O2_AUTH_USER` | Usuario de servicio en OpenObserve | `gateway@tuempresa.com` |
| `O2_AUTH_PASSWORD` | Contraseña de ese usuario | — (secreto) |
| `API_KEYS_JSON` | Array JSON de API keys (alternativa a fichero) | ver `.env.example` |
| `API_KEYS_FILE` | Ruta a fichero JSON con keys (recomendado en producción) | `/run/secrets/api-keys.json` |

> **Recomendación**: crea en OpenObserve un usuario de servicio dedicado al gateway
> (con rol `user`, no `admin`) y usa sus credenciales aquí. No uses el usuario
> administrador.

### Servidor

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP del servidor |
| `NODE_ENV` | `development` | Entorno del proceso |

### Límites de ingesta

| Variable | Default | Descripción |
|---|---|---|
| `ALLOWED_ENVS` | `prod,staging,dev,test` | Entornos válidos en los logs |
| `INGEST_MAX_BATCH` | `1000` | Máximo de eventos por lote (→ `413`) |
| `INGEST_MAX_BODY_MB` | `5` | Tamaño máximo del body en MB (→ `413`) |
| `LOG_MESSAGE_MAX_CHARS` | `8000` | Longitud máxima del campo `message` |
| `MAX_FIELDS_PER_RECORD` | `200` | Máximo de campos por evento |
| `CONTEXT_MAX_DEPTH` | `2` | Profundidad máxima del objeto `context` |
| `CONTEXT_VALUE_MAX_CHARS` | `2000` | Longitud máxima de valores en `context` |

### Cola y entrega

| Variable | Default | Descripción |
|---|---|---|
| `QUEUE_MAX_ITEMS` | `10000` | Capacidad máxima de la cola en memoria |
| `RETRY_ATTEMPTS` | `3` | Intentos de reenvío a OpenObserve |
| `RETRY_BACKOFF_MS` | `200` | Backoff inicial entre reintentos (ms) |
| `DELIVERY_BATCH_MAX` | `500` | Tamaño del lote de entrega a OpenObserve |
| `DELIVERY_FLUSH_MS` | `1000` | Intervalo de flush del worker (ms) |

### Seguridad y red

| Variable | Default | Descripción |
|---|---|---|
| `RATE_LIMIT_RPS` | `100` | Peticiones por segundo por API key |
| `CORS_ALLOWED_ORIGINS` | — | Orígenes de tus **frontends web** separados por coma. No es la URL del propio gateway. Ver nota abajo. |

### Observabilidad

| Variable | Default | Descripción |
|---|---|---|
| `LOG_LEVEL` | `info` | Nivel de logs internos del gateway |
| `METRICS_ENABLED` | `true` | Activar endpoint `/metrics` |

> **Nota sobre `CORS_ALLOWED_ORIGINS`**: esta variable contiene los orígenes de
> las aplicaciones web (ejecutadas en el navegador) que llaman al gateway.
> Por ejemplo, si tienes una app React en `https://miapp.tuempresa.com` que hace
> peticiones al gateway, añade ese origen. Si solo acceden aplicaciones backend
> (servidor a servidor), puedes dejarlo vacío porque CORS solo lo aplican los
> navegadores. No añadas la URL del propio gateway.

---

## Ejecución local (desarrollo)

```bash
# 1. Instalar dependencias exactas del lockfile
npm ci

# 2. Copiar y editar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de OpenObserve

# 3. Arrancar en modo desarrollo (hot-reload)
npm run start:dev
# En Windows puedes usar el script incluido:
# .\arrancar.ps1

# 4. Ejecutar tests
npm run test          # unit + integración
npm run test:e2e      # e2e contra OpenObserve real

# 5. Generar una API key nueva
npm run keygen
```

Los logs de desarrollo se escriben en:
- `.logs/app.log` — legibles por humanos
- `.logs/app.jsonl` — JSON estructurado para análisis

---

## Generación de API keys

```bash
npm run keygen
```

La salida incluye tres valores:

| Valor | Para quién | Para qué |
|---|---|---|
| `key_id` | Operador | Identificar la key en la configuración |
| `secret` | La aplicación cliente | Incluir en la cabecera `Authorization: Bearer <key_id>.<secret>` |
| `secret_hash` | Operador | Configurar en `API_KEYS_JSON`/`API_KEYS_FILE` (nunca el secreto en claro) |

Ejemplo de configuración de keys en `API_KEYS_JSON`:

```json
[
  {
    "id": "key-payments-001",
    "secret_hash": "<sha256-del-secreto>",
    "services": ["payments_api"],
    "scopes": ["write", "read"],
    "client_type": "backend",
    "allowed_origins": [],
    "envs": ["production", "staging"]
  },
  {
    "id": "key-webshop-fe-001",
    "secret_hash": "<sha256-del-secreto>",
    "services": ["web_shop"],
    "scopes": ["write"],
    "client_type": "frontend",
    "allowed_origins": ["https://tienda.tuempresa.com"],
    "envs": ["production"]
  }
]
```

En producción, usa `API_KEYS_FILE` apuntando a un fichero montado como secreto,
en lugar de `API_KEYS_JSON` directamente.

---

## Despliegue con Docker Compose y proxy inverso externo

Ver `docker-compose.yaml` en la raíz del repositorio. El servicio expone el puerto
en la LAN para que el proxy inverso pueda alcanzarlo. Consulta el fichero para
instrucciones detalladas.

### Despliegue en Coolify

1. Crea una nueva aplicación en Coolify apuntando a este repositorio.
2. Selecciona **Docker Compose** como método de despliegue.
3. Configura las variables de entorno en la interfaz de Coolify.
4. Monta el fichero de API keys como secreto en `/run/secrets/api-keys.json`.
5. El healthcheck del contenedor apunta a `GET /api/v1/health/ready`.

---

## Endpoints

| Método | Ruta | Auth | Scope | Descripción |
|---|---|---|---|---|
| `POST` | `/api/v1/logs` | Bearer | `write` | Ingestar uno o varios logs |
| `POST` | `/api/v1/logs/batch` | Bearer | `write` | Ingestar un lote (gzip opcional) |
| `GET` | `/api/v1/logs` | Bearer | `read` | Consultar logs con filtros |
| `GET` | `/api/v1/services` | Bearer | — | Capacidades de la API key actual |
| `GET` | `/api/v1/health` | No | — | Liveness check |
| `GET` | `/api/v1/health/ready` | No | — | Readiness (comprueba OpenObserve) |
| `GET` | `/api/v1/metrics` | No | — | Métricas Prometheus |

Documentación interactiva completa (Swagger UI):

```
http://localhost:3000/api/docs          ← desarrollo local
https://apiopenobs.tuempresa.com/api/docs  ← producción
```

Spec en JSON (importable en Postman desde URL):

```
http://localhost:3000/api/docs-json
```

Para documentación de integración completa con ejemplos, snippets de código y
descripción detallada de cada endpoint, ver `docs/manual-de-integracion.md`.

---

## Métricas Prometheus

El endpoint `GET /api/v1/metrics` expone métricas en formato Prometheus.

Ejemplo de `scrape_config` para añadir a `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: log_gateway
    static_configs:
      - targets: ['log-gateway:3000']
    metrics_path: /api/v1/metrics
    scrape_interval: 30s
```

| Métrica | Tipo | Descripción |
|---|---|---|
| `log_gateway_ingest_accepted_total` | Counter | Eventos aceptados en cola |
| `log_gateway_ingest_rejected_total` | Counter | Eventos rechazados por validación |
| `log_gateway_o2_delivery_failed_total` | Counter | Fallos de entrega a OpenObserve |
| `log_gateway_o2_delivery_retried_total` | Counter | Reintentos de entrega |
| `log_gateway_queue_depth` | Gauge | Eventos actualmente en la cola |
| `log_gateway_rate_limited_total` | Counter | Peticiones rechazadas por rate limit |
| `log_gateway_request_duration_seconds` | Histogram | Duración de las peticiones HTTP |
| `log_gateway_redacted_fields_total` | Counter | Campos sensibles redactados |
| `log_gateway_context_truncated_total` | Counter | Eventos con contexto truncado |

---

## Arquitectura interna (resumen)

```
HTTP Request
    │
    ▼
[ Guards: ApiKeyAuthGuard + ThrottleByKeyGuard ]
    │ 401/403/429
    ▼
[ Controllers: parseo, delegación ]
    │
    ▼
[ Application Services: casos de uso ]
    │
    ├──► Ingesta ──► [ Domain: validación, normalización, redacción ]
    │                    │
    │                    ▼
    │              [ Queue: cola en memoria acotada ]
    │                    │
    │                    ▼
    │              [ DeliveryWorker: lotes + reintentos ]
    │                    │
    │                    ▼
    │              [ OpenObserve: _json/_multi (ingesta) ]
    │
    └──► Consulta ► [ Domain: SQL builder por allowlist ]
                         │
                         ▼
                   [ OpenObserve: _search (consulta) ]
```

El dominio (validación, normalización, redacción, construcción de SQL) es puro
TypeScript sin dependencias de framework, testeable de forma aislada.

---

## Licencia

Copyright 2026 Daniel Diez Mardomingo

Distribuido bajo la [Apache License, Version 2.0](LICENSE).

Puedes usar, copiar, modificar y distribuir este software libremente, incluso con
fines comerciales, siempre que conserves el aviso de copyright y la copia de la
licencia. Ver el fichero [`LICENSE`](LICENSE) para el texto completo.
