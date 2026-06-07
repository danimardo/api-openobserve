# Feature Specification: API de logging centralizado sobre OpenObserve (Log Gateway)

**Feature Branch**: `001-log-gateway-api`

**Created**: 2026-06-06

**Status**: Draft

**Input**: User description: "Especificación funcional y técnica - API de logging centralizado sobre OpenObserve. API intermedia (log gateway) en NestJS que recibe logs de aplicaciones propias frontend/backend y los reenvía a OpenObserve sin exponer credenciales, con ingesta validada/normalizada, consulta filtrada segura, aislamiento por servicio mediante API keys, rate limit, métricas Prometheus y despliegue en Coolify."

## Source & Traceability

`Historias.md` es la fuente original de requisitos de cliente. Esta spec es el contrato reconciliado para la feature `001-log-gateway-api`; cualquier detalle operativo o funcional necesario para implementar el MVP debe quedar reflejado aquí antes de pasar a plan o tareas.

### Objectives

- **O1**: Permitir que aplicaciones propias envíen logs con integración mínima.
- **O2**: Evitar que credenciales de OpenObserve vivan fuera del gateway.
- **O3**: Aislar logs por aplicación mediante un stream por servicio.
- **O4**: Normalizar el formato de logs para facilitar búsquedas y dashboards.
- **O5**: Permitir consultas programáticas de logs con filtros seguros.
- **O6**: Evitar que fallos o lentitud del sistema de logging rompan aplicaciones cliente.
- **O7**: Dejar despliegue, configuración, tests y operación documentados.

## Clarifications

### Session 2026-06-06

- Q: ¿Qué formato tiene el token Bearer de API key (para permitir comparación en tiempo constante)? → A: Token compuesto `<key_id>.<secret>`: se separa por el primer `.`, se busca la key por `key_id` y se compara `hash(secret)` con `secret_hash` en tiempo constante; `keygen` emite `key_id` + secreto + hash.
- Q: ¿Qué valores permite el campo `source` del `LogEvent` y qué pasa con uno desconocido? → A: Enum cerrado `backend | frontend`, opcional; un valor fuera del enum se normaliza a `unknown` sin rechazar el registro.
- Q: ¿Cómo entrega el worker los eventos encolados a OpenObserve (uno a uno o por lotes)? → A: El worker agrupa por stream y entrega en lotes con flush por tamaño (`DELIVERY_BATCH_MAX`, def. 500) o intervalo (`DELIVERY_FLUSH_MS`, def. 1000), lo que ocurra antes; reintentos/backoff por lote.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ingestar logs sin exponer credenciales de OpenObserve (Priority: P1)

Como aplicación cliente (backend o frontend), quiero enviar uno o varios eventos de log a la API mediante una API key propia, para que queden almacenados en el stream correcto de OpenObserve sin que mi aplicación conozca las credenciales internas de OpenObserve.

**Why this priority**: Es la razón de ser del gateway. Sin ingesta válida y aislada por servicio no hay producto. Cumple los objetivos O1, O2, O3 y O4. Es el slice mínimo que ya aporta valor: centralizar logs de forma segura.

**Independent Test**: Con una API key `write` válida, enviar `POST /api/v1/logs` con un evento válido y comprobar respuesta `202` y que el evento aparece en el stream de OpenObserve correspondiente al `service`. Verificable de extremo a extremo sin depender de las demás historias.

**Acceptance Scenarios**:

1. **Given** una API key válida con scope `write` autorizada para `payments_api`, **When** envío un `LogEvent` válido a `POST /api/v1/logs`, **Then** recibo `202 Accepted` con `accepted: 1, rejected: 0` y el evento queda en el stream `payments_api`.
2. **Given** un evento sin `_timestamp`, **When** lo envío, **Then** la API lo rellena con la hora de recepción antes de reenviarlo.
3. **Given** una API key autorizada solo para `web_shop`, **When** envío un evento con `service: "payments_api"`, **Then** ese registro se rechaza (rechazo por registro en ingesta parcial).
4. **Given** un body que es un único objeto `LogEvent` o un array de eventos, **When** lo envío a `POST /api/v1/logs`, **Then** ambos formatos se aceptan.

---

### User Story 2 - Consultar logs por servicio con filtros seguros (Priority: P1)

Como operador o integración interna, quiero consultar logs de un servicio autorizado por rango temporal, nivel, entorno, texto y correlación, para automatizar análisis sin acceder directamente a OpenObserve y sin riesgo de inyección SQL.

**Why this priority**: La consulta programática segura es la segunda responsabilidad principal del gateway (O5) y la única vía de lectura controlada. Es independiente de la ingesta: puede probarse contra datos preexistentes en OpenObserve.

**Independent Test**: Con una API key `read` autorizada para un servicio, llamar `GET /api/v1/logs?service=...` con filtros y comprobar que devuelve `items` y `next_cursor`, que respeta la allowlist y que entradas maliciosas en `q`/`trace_id`/`request_id` no alteran la consulta.

**Acceptance Scenarios**:

1. **Given** una API key `read` autorizada para `payments_api`, **When** consulto `GET /api/v1/logs?service=payments_api&level=error&from=...&to=...`, **Then** recibo `200` con `items` filtrados y `next_cursor`.
2. **Given** una consulta sin `service`, **When** la envío, **Then** recibo `400 validation_error`.
3. **Given** una API key sin autorización para el `service` solicitado, **When** consulto, **Then** recibo `403 forbidden`.
4. **Given** valores maliciosos en `q`, `trace_id` o `request_id`, **When** consulto, **Then** el SQL generado se escapa correctamente y no se ejecuta inyección.
5. **Given** un `next_cursor` devuelto en una respuesta previa, **When** lo paso como `cursor`, **Then** obtengo la página siguiente de forma estable.

---

### User Story 3 - Aislamiento por aplicación mediante API keys (Priority: P1)

Como responsable de seguridad, quiero que cada API key defina `services` y `scopes` de forma que una aplicación solo pueda escribir y leer los streams que tenga autorizados, para garantizar aislamiento entre aplicaciones.

**Why this priority**: El aislamiento es transversal y bloqueante para ingesta y consulta. Sin él, las historias 1 y 2 no son seguras. Cubre O3 y la sección de seguridad de la constitución.

**Independent Test**: Cargar keys de prueba con distintos `services`/`scopes` y verificar que cada operación respeta las autorizaciones (write solo escribe en sus servicios, read solo consulta los suyos, `services: ["*"]` solo lectura).

**Acceptance Scenarios**:

1. **Given** una key con scope `write` para `payments_api`, **When** intenta consultar logs, **Then** recibe `403` por falta de scope `read`.
2. **Given** una key con scope `read` para `payments_api`, **When** intenta escribir, **Then** recibe `403` por falta de scope `write`.
3. **Given** una key con `services: ["*"]`, **When** intenta escribir, **Then** se rechaza; solo puede usarse para lectura/observabilidad interna.
4. **Given** entorno de producción y una key con `services: ["*"]`, **When** arranca la aplicación, **Then** la configuración se considera inválida (no se permite `["*"]` en producción).

---

### User Story 4 - Resiliencia del cliente ante fallos de logging (Priority: P2)

Como propietario de una aplicación cliente, quiero que el fallo o la lentitud del logging no interrumpa la lógica de negocio, mediante snippets de referencia best effort con buffer, flush periódico, timeout y captura de errores.

**Why this priority**: Cubre O6. No es bloqueante para que el gateway funcione, pero es parte del entregable y de la propuesta de valor (fire and forget). Se entrega como snippets + documentación, no como SDK.

**Independent Test**: Revisar/ejecutar los snippets de referencia simulando errores de red o timeout y comprobar que no propagan excepciones a la aplicación cliente y que aplican buffer/flush/límite de reintentos.

**Acceptance Scenarios**:

1. **Given** el snippet backend de referencia, **When** la API responde error o agota timeout, **Then** el error se captura y no se propaga a la lógica de negocio.
2. **Given** el snippet frontend de referencia, **When** se produce un error de envío, **Then** se usa `fetch` con `keepalive` y `Authorization` y el fallo se ignora silenciosamente.
3. **Given** acumulación de eventos, **When** se alcanza el umbral de buffer o el intervalo de flush, **Then** se envía el lote a `POST /api/v1/logs/batch`.

---

### User Story 5 - Lectura desde frontend con alcance reducido (Priority: P2)

Como aplicación frontend, quiero consultar logs de mi propio `service` y `env` con una respuesta reducida y límites estrictos, para mostrar información técnica acotada sin exponer logs de otros servicios.

**Why this priority**: Habilita el caso de uso frontend de lectura (HU11, D18, D28) respetando que las keys frontend son públicas. Depende de la historia 2 (consulta) pero añade restricciones específicas.

**Independent Test**: Con una key frontend `read`, consultar logs y verificar respuesta reducida, eliminación de campos sensibles/conocidos en `context`, prohibición de `q`, recorte de ventana >7 días con `range_truncated: true` y recorte de `limit` >500 con `limit_truncated: true`.

**Acceptance Scenarios**:

1. **Given** una key frontend `read` para `web_shop`/`prod`, **When** consulta sus logs, **Then** recibe respuesta reducida (`_timestamp`, `level`, `message`, `service`, `env`, `request_id`, `trace_id`, `context` sin campos sensibles/conocidos).
2. **Given** una key frontend, **When** usa el parámetro `q`, **Then** la operación se rechaza (frontend no puede usar `q`).
3. **Given** una key frontend que pide una ventana mayor de 7 días, **When** consulta, **Then** la API recorta el rango y devuelve `range_truncated: true`.
4. **Given** una key frontend que pide `limit > 500`, **When** consulta, **Then** la API recorta a 500 y devuelve `limit_truncated: true`.
5. **Given** una key frontend, **When** consulta un `service`/`env` distinto al autorizado, **Then** recibe `403`.
6. **Given** una key frontend, **When** consulta logs con `context`, **Then** la respuesta elimina campos sensibles/conocidos en lugar de devolverlos completos o redactados.

---

### User Story 6 - Envío por lotes con compresión y aceptación parcial (Priority: P2)

Como aplicación cliente, quiero enviar lotes grandes de logs en una sola llamada, opcionalmente comprimidos con gzip, recibiendo conteos de aceptados/rechazados y errores por índice.

**Why this priority**: Reduce overhead de red y es clave para clientes con alto volumen. Extiende la ingesta (historia 1) con `POST /api/v1/logs/batch`, límites y aceptación parcial.

**Independent Test**: Enviar un array con registros válidos e inválidos a `POST /api/v1/logs/batch` (con y sin `Content-Encoding: gzip`) y verificar `202` con conteos y `errors` por índice; verificar rechazo al superar límites.

**Acceptance Scenarios**:

1. **Given** un array mixto válido/ inválido, **When** lo envío a `/logs/batch`, **Then** recibo `202` con `accepted`, `rejected` y `errors[]` indexados.
2. **Given** un lote con `Content-Encoding: gzip`, **When** lo envío, **Then** se descomprime y procesa correctamente.
3. **Given** un lote que supera `INGEST_MAX_BATCH` o `INGEST_MAX_BODY_MB`, **When** lo envío, **Then** recibo `413 payload_too_large`.
4. **Given** un body que no es array en `/logs/batch`, **When** lo envío, **Then** recibo `400 validation_error`.
5. **Given** un lote sin ningún registro válido, **When** lo envío, **Then** recibo `400 validation_error` con `details` por índice.

---

### User Story 7 - Normalización y redacción de eventos (Priority: P2)

Como plataforma de observabilidad, quiero que todos los eventos se normalicen (level, timestamp, context aplanado, campos desconocidos a `context.extra`) y que los campos sensibles conocidos se enmascaren antes de llegar a OpenObserve, para facilitar búsquedas y evitar fugas de secretos.

**Why this priority**: Cubre O4 y la política de PII/secretos. Es parte del pipeline de ingesta y condiciona la calidad de los datos almacenados.

**Independent Test**: Enviar eventos con `level` en mayúsculas/equivalencias, sin `_timestamp`, con `context` profundo y con campos sensibles, y verificar normalización, marcas de truncado y `***redacted***`.

**Acceptance Scenarios**:

1. **Given** `level: "WARNING"`, **When** lo envío, **Then** se normaliza a `warn`; un `level` desconocido tras normalizar se rechaza con `invalid_level`.
2. **Given** `context` que supera `CONTEXT_MAX_DEPTH` o un registro que supera `MAX_FIELDS_PER_RECORD`, **When** lo envío, **Then** se recorta `context`, se acepta el registro y se marca `context_truncated: true`.
3. **Given** campos sensibles conocidos o PII conocida por nombre de campo en `context` (p. ej. `password`, `token`, `iban`, `email`, `phone`, `dni`, `nif`), **When** lo envío, **Then** se sustituyen por `***redacted***` y se incrementa la métrica de redacción.
4. **Given** campos no reconocidos en la raíz del evento, **When** lo envío, **Then** se mueven a `context.extra`.
5. **Given** valores `undefined`/`NaN`/no serializables, **When** lo envío, **Then** se eliminan o convierten a string de forma controlada.

---

### User Story 8 - Descubrir capacidades de la API key (Priority: P3)

Como consumidor de la API, quiero consultar qué servicios, entornos, scopes y límites tiene mi key, para configurar clientes y pruebas sin conocer secretos internos.

**Why this priority**: Mejora la experiencia de integración (HU12). No es bloqueante para ingesta/consulta pero reduce fricción y errores de configuración.

**Independent Test**: Llamar `GET /api/v1/services` con distintas keys y verificar que devuelve solo lo autorizado para esa key y nunca hashes/secretos ni información de otras keys.

**Acceptance Scenarios**:

1. **Given** una key válida, **When** llamo `GET /api/v1/services`, **Then** recibo servicios, entornos, scopes y límites aplicables a esa key.
2. **Given** cualquier key, **When** llamo el endpoint, **Then** la respuesta no incluye `secret_hash`, secretos ni configuración de otras keys.
3. **Given** una key frontend, **When** llamo el endpoint, **Then** los límites reflejan `max_query_window`, `max_limit`, `allow_q: false` y `response_profile: frontend_reduced`.

---

### User Story 9 - Salud y readiness para despliegue (Priority: P2)

Como operador de Coolify, quiero endpoints de liveness y readiness, para que la plataforma sepa si la API está viva y si puede comunicarse con OpenObserve.

**Why this priority**: Necesario para un despliegue operable y reproducible (HU7, HU10). Independiente del flujo de logs.

**Independent Test**: Llamar `GET /api/v1/health` (siempre `200` si el proceso vive) y `GET /api/v1/health/ready` con OpenObserve disponible (`200`) y no disponible (`503`).

**Acceptance Scenarios**:

1. **Given** el proceso HTTP vivo, **When** llamo `GET /api/v1/health`, **Then** recibo `200` sin comprobar OpenObserve.
2. **Given** OpenObserve accesible y credenciales válidas, **When** llamo `GET /api/v1/health/ready`, **Then** recibo `200`.
3. **Given** OpenObserve inaccesible o configuración inválida, **When** llamo `GET /api/v1/health/ready`, **Then** recibo `503`.

---

### User Story 10 - Límites y rate limiting anti-abuso (Priority: P2)

Como responsable de plataforma, quiero rate limit por API key y límites de payload, lote, campos y longitudes, para evitar que un cliente degrade el servicio.

**Why this priority**: Protege la disponibilidad (HU8). Transversal a ingesta y consulta.

**Independent Test**: Superar el rate limit por key y los distintos límites de tamaño y verificar los códigos `429` y `413` correspondientes.

**Acceptance Scenarios**:

1. **Given** una key que supera `RATE_LIMIT_RPS`, **When** sigue enviando, **Then** recibe `429 rate_limited` y se incrementa la métrica de rate limit.
2. **Given** un body que supera `INGEST_MAX_BODY_MB`, **When** lo envío, **Then** recibo `413 payload_too_large`.
3. **Given** un `message` que supera `LOG_MESSAGE_MAX_CHARS`, **When** lo envío, **Then** el registro se rechaza por validación.
4. **Given** un lote que supera `INGEST_MAX_BATCH`, **When** lo envío, **Then** recibo `413`.

---

### User Story 11 - Observabilidad de la propia API (Priority: P2)

Como operador, quiero que el gateway emita sus propios logs y métricas Prometheus, para detectar fallos de ingesta, rate limits y problemas con OpenObserve.

**Why this priority**: Cubre O7 y HU9. Imprescindible para operar el MVP, aunque no bloquea la funcionalidad básica de cliente.

**Independent Test**: Llamar `GET /api/v1/metrics` y verificar que expone las métricas mínimas; provocar aceptados/rechazados/rate limited/fallos O2 y verificar que los contadores cambian y que los logs internos no incluyen secretos ni payloads completos.

**Acceptance Scenarios**:

1. **Given** tráfico de ingesta y consulta, **When** llamo `GET /api/v1/metrics`, **Then** obtengo formato Prometheus con las métricas mínimas (aceptados, rechazados, fallos O2, reintentos, profundidad de cola, rate limited, duración, redacciones, truncados).
2. **Given** actividad del gateway, **When** reviso sus logs internos, **Then** se escriben a stdout/stderr y al stream `log_gateway`, sin secretos ni payload completo de clientes.
3. **Given** un fallo al enviar logs internos a OpenObserve, **When** ocurre, **Then** no se entra en bucles recursivos de logging.

---

### User Story 12 - Gestión de API keys por configuración (Priority: P2)

Como operador, quiero gestionar las API keys por configuración (sin base de datos) y generar secretos con una herramienta, para mantener la API stateless y permitir rotación.

**Why this priority**: Soporta el modelo de seguridad y operación del MVP (HU6). Necesario para arrancar con keys reales.

**Independent Test**: Cargar keys desde `API_KEYS_JSON` y desde `API_KEYS_FILE`, ejecutar `npm run keygen` y verificar generación de secreto + hash; comprobar comparación en tiempo constante.

**Acceptance Scenarios**:

1. **Given** `API_KEYS_JSON` o un fichero montado, **When** arranca la API, **Then** carga y valida las keys; los secretos se almacenan solo como hash.
2. **Given** la herramienta `npm run keygen`, **When** la ejecuto, **Then** genera un secreto de alta entropía y su hash para configurar una key.
3. **Given** la verificación de una key entrante, **When** se compara el secreto, **Then** la comparación se hace en tiempo constante.

---

### User Story 13 - Despliegue reproducible en Coolify (Priority: P3)

Como operador, quiero un `Dockerfile`, `.env.example` y documentación clara, para desplegar la solución en Coolify con configuración y healthcheck definidos.

**Why this priority**: Cierra O7 y HU10. Depende de que el resto exista, por eso es P3, pero es entregable obligatorio.

**Independent Test**: Construir la imagen con el `Dockerfile`, arrancar con variables de entorno de ejemplo y comprobar que el healthcheck `/api/v1/health/ready` responde y que el README documenta variables, ejecución local y despliegue.

**Acceptance Scenarios**:

1. **Given** el repositorio, **When** construyo la imagen multi-stage, **Then** se ejecuta como usuario no root con solo dependencias de producción.
2. **Given** Coolify configurado, **When** inyecto secretos como variables de entorno y apunto el healthcheck a `/api/v1/health/ready`, **Then** el servicio queda operativo.
3. **Given** el README y `.env.example`, **When** los reviso, **Then** describen todas las variables, ejecución local, despliegue y ejemplo de `scrape_config` de Prometheus, sin secretos reales.

---

### Edge Cases

- **Body JSON malformado**: responder `400 validation_error` sin procesar registros.
- **Content-Type no soportado**: responder `415 unsupported_media_type`.
- **Lote enteramente inválido**: responder `400` con `details` por índice; lote parcialmente válido responde `202`.
- **Cola en memoria saturada**: rechazar con `429 rate_limited` cuando se supera `QUEUE_MAX_ITEMS`; documentar posible pérdida en reinicios/caídas.
- **Caída del proceso con cola pendiente**: los logs en memoria pueden perderse (best effort declarado, una sola réplica en MVP).
- **OpenObserve responde error en consulta síncrona**: responder `502 openobserve_error`.
- **Fallos contra O2 en ingesta**: reintentar con backoff (`RETRY_ATTEMPTS`, `RETRY_BACKOFF_MS`); tras agotar, registrar fallo y métrica sin romper al cliente (ya respondió `202`).
- **Request con múltiples `service`**: agrupar por `service`/stream antes de llamar a OpenObserve.
- **`_timestamp` en ISO-8601 vs microsegundos**: convertir internamente al formato que requiera O2.
- **Duplicados por reintentos**: aceptados; no hay deduplicación estricta en MVP (`event_id` solo trazabilidad).
- **Origen CORS no permitido en navegador**: bloqueado por CORS, aunque CORS no impide llamadas server-to-server (por eso límites y scopes).
- **Cliente reenvía `request_id`**: conservar solo tras validarlo; si falta o es inválido, generar uno nuevo.

## Requirements *(mandatory)*

### Functional Requirements

**Ingesta**

- **FR-001**: El sistema MUST aceptar `POST /api/v1/logs` con un único objeto `LogEvent` o un array de eventos.
- **FR-002**: El sistema MUST aceptar `POST /api/v1/logs/batch` exigiendo un array y soportando `Content-Encoding: gzip`.
- **FR-003**: El sistema MUST responder `202` cuando al menos un registro es aceptado, con conteos `accepted`/`rejected` y, si procede, `errors[]` por índice.
- **FR-004**: El sistema MUST responder `400 validation_error` cuando no hay ningún registro válido o el JSON está malformado.
- **FR-005**: El sistema MUST agrupar los registros válidos por `service`/stream antes de enviarlos a OpenObserve.
- **FR-006**: El sistema MUST rellenar `_timestamp` con la hora de recepción cuando falte y convertir ISO-8601 al formato que requiera OpenObserve.
- **FR-007**: El sistema MUST encolar los registros válidos en una cola en memoria acotada y entregarlos mediante un worker con reintentos y backoff configurables; responde `202` cuando entran en cola. El worker MUST agrupar los eventos por stream y entregarlos a OpenObserve en lotes, haciendo flush cuando se alcanza `DELIVERY_BATCH_MAX` registros o transcurre `DELIVERY_FLUSH_MS` desde el primer evento pendiente del lote (lo que ocurra antes); los reintentos y el backoff se aplican por lote.
- **FR-008**: El sistema MUST rechazar nuevas entradas con `429 rate_limited` cuando la cola supera `QUEUE_MAX_ITEMS`.
- **FR-009**: El sistema MUST aceptar duplicados por reintentos sin deduplicación estricta; `event_id` es opcional y solo para trazabilidad.

**Validación y normalización**

- **FR-010**: El sistema MUST validar cada `LogEvent` en runtime: `service` (`^[a-z0-9_]{3,64}$` y autorizado por la key), `env` (dentro de `ALLOWED_ENVS`), `level`, `message` (1..`LOG_MESSAGE_MAX_CHARS`) y `source` (opcional, enum cerrado `backend|frontend`; un valor fuera del enum se normaliza a `unknown` sin rechazar el registro).
- **FR-011**: El sistema MUST normalizar `level` a minúsculas y mapear equivalencias (`warning→warn`, `err→error`, `critical→fatal`); si sigue siendo desconocido, rechazar el registro con `invalid_level`.
- **FR-012**: El sistema MUST aplanar `context` por puntos hasta `CONTEXT_MAX_DEPTH`, mover campos raíz no reconocidos a `context.extra`, y eliminar/convertir valores no serializables.
- **FR-013**: El sistema MUST recortar `context` y marcar `context_truncated: true` cuando se supere `CONTEXT_MAX_DEPTH` o `MAX_FIELDS_PER_RECORD`, sin rechazar el registro completo (salvo JSON inválido).
- **FR-014**: El sistema MUST enmascarar campos sensibles conocidos y PII conocida por nombre de campo (`password`, `token`, `authorization`, `cookie`, `set_cookie`, `secret`, `api_key`, `credit_card`, `iban`, `email`, `phone`, `telephone`, `dni`, `nif`, `full_name`, `address`) con `***redacted***` antes de enviar a OpenObserve e incrementar la métrica de redacción. El MVP MUST NOT escanear texto libre de `message` con detección avanzada de PII; los clientes no deben enviar PII directa en `message`.

**Consulta**

- **FR-015**: El sistema MUST exponer `GET /api/v1/logs` exigiendo `service` y soportando filtros `from`, `to`, `level`, `env`, `q`, `trace_id`, `request_id`, `limit`, `cursor` y `sort`. Defaults: `from=now-1h`, `to=now`, `limit=100`, `sort=desc`; `limit` máximo para keys no frontend: `1000`; `level` puede aceptar uno o varios niveles separados por coma.
- **FR-016**: El sistema MUST construir SQL contra OpenObserve con allowlists para `service`/`level`/`env`/`sort`, acotando `limit` y escapando `q`/`trace_id`/`request_id`; los campos consultables son fijos.
- **FR-017**: El sistema MUST devolver `items`, `next_cursor` (cursor opaco), `range_truncated`, `limit_truncated` y `request_id` en la respuesta de consulta. El sistema MUST NOT devolver `total` por defecto; si se añade `include_total=true`, MUST limitarse a keys backend/internas y documentarse como operación potencialmente costosa.
- **FR-018**: El sistema MUST aplicar a keys frontend: solo su `service`/`env`, respuesta reducida (`response_profile: frontend_reduced`), eliminación de campos sensibles/conocidos del `context` de respuesta, prohibición de `q`, ventana máxima 7 días (recorte + `range_truncated: true`) y `limit` máximo 500 (recorte + `limit_truncated: true`).
- **FR-019**: El sistema MUST devolver `502 openobserve_error` cuando OpenObserve falle en una operación de consulta síncrona.

**Autenticación y autorización**

- **FR-020**: El sistema MUST autenticar mediante `Authorization: Bearer <API_KEY>`, donde `<API_KEY>` es un token compuesto `<key_id>.<secret>`. El sistema MUST separar el token por el primer `.`, localizar la key por `key_id` y, solo si existe, comparar `hash(secret)` con su `secret_hash`. Sin cabecera, formato de token inválido (sin `.`), `key_id` inexistente o secreto no coincidente → `401`.
- **FR-021**: El sistema MUST devolver `403` cuando la key es válida pero carece del scope necesario o de acceso al `service` en operaciones de consulta; en ingesta, rechazar por registro.
- **FR-022**: El sistema MUST definir por key `services` y `scopes` (`read`/`write`) y aplicarlos: `write` solo escribe sus servicios, `read` solo consulta los suyos.
- **FR-023**: El sistema MUST impedir en producción keys con `services: ["*"]` y permitir `["*"]` únicamente para lectura/observabilidad interna.
- **FR-024**: El sistema MUST impedir que keys frontend autoricen streams backend o el stream `log_gateway`.
- **FR-025**: El sistema MUST cargar keys desde `API_KEYS_JSON` o `API_KEYS_FILE`, almacenar secretos solo como hash SHA-256 y comparar en tiempo constante el `hash(secret)` del token entrante contra el `secret_hash` de la key identificada por `key_id`.
- **FR-026**: El sistema MUST proveer `npm run keygen` para generar un `key_id`, un secreto de alta entropía y su hash SHA-256, de forma que el operador pueda construir el token `<key_id>.<secret>` y configurar la key con su `secret_hash`.

**Descubrimiento, salud y métricas**

- **FR-027**: El sistema MUST exponer `GET /api/v1/services` devolviendo solo servicios, entornos, scopes y límites de la key actual, sin hashes/secretos ni datos de otras keys.
- **FR-028**: El sistema MUST exponer públicamente `GET /api/v1/health` (liveness, sin comprobar O2) y `GET /api/v1/health/ready` (readiness, `200` si conecta con O2, `503` si no), sin requerir API key.
- **FR-029**: El sistema MUST exponer públicamente `GET /api/v1/metrics` en formato Prometheus, sin requerir API key, con las métricas mínimas: `log_gateway_ingest_accepted_total`, `log_gateway_ingest_rejected_total`, `log_gateway_o2_delivery_failed_total`, `log_gateway_o2_delivery_retried_total`, `log_gateway_queue_depth`, `log_gateway_rate_limited_total`, `log_gateway_request_duration_seconds`, `log_gateway_redacted_fields_total`, `log_gateway_context_truncated_total`.

**Límites, rate limit y CORS**

- **FR-030**: El sistema MUST aplicar rate limit por API key (`RATE_LIMIT_RPS`) devolviendo `429 rate_limited` al superarlo.
- **FR-031**: El sistema MUST aplicar límites configurables: `INGEST_MAX_BODY_MB` (→ `413`), `INGEST_MAX_BATCH` (→ `413`), `MAX_FIELDS_PER_RECORD`, `LOG_MESSAGE_MAX_CHARS`, `CONTEXT_MAX_DEPTH` y `CONTEXT_VALUE_MAX_CHARS`. Para requests gzip, el sistema MUST medir tanto el body comprimido como el JSON descomprimido; si cualquiera supera `INGEST_MAX_BODY_MB`, MUST responder `413 payload_too_large`.
- **FR-032**: El sistema MUST devolver `415 unsupported_media_type` ante Content-Type no soportado.
- **FR-033**: El sistema MUST aplicar CORS restringido según `allowed_origins` de la key y/o `CORS_ALLOWED_ORIGINS`.

**Observabilidad interna y seguridad de datos**

- **FR-034**: El sistema MUST emitir sus propios logs estructurados a stdout/stderr y al stream `log_gateway`, sin secretos, credenciales, headers `Authorization`, cookies ni payloads completos de cliente, y sin bucles recursivos si falla el envío a O2.
- **FR-035**: El sistema MUST incluir `request_id` en respuestas normales y de error, y usar el formato de error estándar `{ error: { code, message, details }, request_id }`.
- **FR-036**: El sistema MUST permitir guardar IPs completas e IDs técnicos en logs. La PII directa conocida por nombre de campo MUST redactarse según FR-014; la detección avanzada de PII en texto libre queda fuera del MVP.

**Configuración**

- **FR-037**: El sistema MUST validar toda la configuración de entorno con un schema al arrancar y fallar rápido si falta una variable obligatoria (`O2_URL`, `O2_ORG`, `O2_AUTH_USER`, `O2_AUTH_PASSWORD`, `API_KEYS_JSON`/`API_KEYS_FILE`) o tiene formato inválido.
- **FR-038**: El sistema MUST exponer y respetar valores por defecto de límites: `INGEST_MAX_BATCH=1000`, `INGEST_MAX_BODY_MB=5`, `LOG_MESSAGE_MAX_CHARS=8000`, `MAX_FIELDS_PER_RECORD=200`, `CONTEXT_MAX_DEPTH=2`, `CONTEXT_VALUE_MAX_CHARS=2000`, `QUEUE_MAX_ITEMS=10000`, `RETRY_ATTEMPTS=3`, `RETRY_BACKOFF_MS=200,1000,5000`, `DELIVERY_BATCH_MAX=500`, `DELIVERY_FLUSH_MS=1000`, `RATE_LIMIT_RPS=100`, `ALLOWED_ENVS=prod,staging,dev,test`.

**Entregables**

- **FR-039**: El proyecto MUST entregar `Dockerfile` multi-stage (usuario no root), `.env.example` sin secretos, README (config, ejecución local, despliegue Coolify, ejemplo `scrape_config`), colección Postman (schema 2.1.0) y snippets de integración backend/frontend.

### Key Entities *(include if feature involves data)*

- **LogEvent (evento de log normalizado)**: representa un evento individual. Atributos: `_timestamp` (opcional, ISO-8601 o int64 µs), `service` (obligatorio), `env` (obligatorio, enum de `ALLOWED_ENVS`), `version`, `level` (obligatorio, enum normalizado), `message` (obligatorio), `event_id`, `trace_id`, `span_id`, `request_id`, `hostname`, `source` (opcional, enum `backend|frontend`; valor desconocido → `unknown`), `context` (objeto). Marcas de proceso: `context_truncated`.
- **API Key**: credencial de aplicación contra el gateway. El token entrante es `<key_id>.<secret>`; `key_id` identifica la key y `secret` se verifica contra `secret_hash`. Atributos: `id` (`key_id`, usado como prefijo del token), `secret_hash` (SHA-256), `services[]`, `scopes[]` (`read`/`write`), `allowed_origins[]`, opcional `envs[]`, `client_type` (`frontend`/backend), `read_policy` (`response_profile`, `allow_q`, `max_query_window`, `max_limit`). No expone secreto en claro.
- **Service / Stream**: aplicación emisora; un stream `logs` por `service` en una única organización OpenObserve. Nombre `^[a-z0-9_]{3,64}$`, creado automáticamente en la primera ingesta. Tiene retención por entorno con posibles excepciones por stream.
- **Query / Resultado de consulta**: parámetros de filtro validados y respuesta con `items`, `next_cursor`, `range_truncated`, `limit_truncated`, `request_id`. `total` no forma parte de la respuesta por defecto.
- **Cola de entrega**: estructura en memoria acotada (`QUEUE_MAX_ITEMS`) con eventos agrupados por stream, consumida por un worker que entrega a OpenObserve en lotes (`DELIVERY_BATCH_MAX` / `DELIVERY_FLUSH_MS`) con reintentos y backoff por lote.

### Operational Defaults & OpenObserve Guidance

**Retención recomendada en OpenObserve**: `prod=90 días`, `staging=30 días`, `dev=30 días`, `test=7 días`. Estos valores son recomendación operativa, no requisito funcional bloqueante del MVP; se permiten excepciones por stream si se configuran en OpenObserve.

**Índices recomendados en OpenObserve**: `message` con full-text/inverted index; `level`, `env`, `service` y `hostname` con secondary index o equivalente; `trace_id` y `request_id` con bloom filter, índice de igualdad o estrategia equivalente para búsquedas exactas.

**Variables de entorno esperadas**: `PORT`, `NODE_ENV`, `O2_URL`, `O2_ORG`, `O2_AUTH_USER`, `O2_AUTH_PASSWORD`, `API_KEYS_JSON`, `API_KEYS_FILE`, `ALLOWED_ENVS`, `INGEST_MAX_BATCH`, `INGEST_MAX_BODY_MB`, `LOG_MESSAGE_MAX_CHARS`, `CONTEXT_MAX_DEPTH`, `CONTEXT_VALUE_MAX_CHARS`, `MAX_FIELDS_PER_RECORD`, `QUEUE_MAX_ITEMS`, `RETRY_ATTEMPTS`, `RETRY_BACKOFF_MS`, `DELIVERY_BATCH_MAX`, `DELIVERY_FLUSH_MS`, `RATE_LIMIT_RPS`, `CORS_ALLOWED_ORIGINS`, `LOG_LEVEL`, `METRICS_ENABLED`.

### Traceability IDs

**Decisiones de cliente referenciadas**: **D9** entrega best effort con cola en memoria, reintentos y métricas; **D10** una sola réplica en MVP; **D18** lectura frontend permitida con alcance reducido; **D24** snippets y documentación, no SDK npm; **D25** colección Postman; **D26** frontend usa `fetch` con `keepalive` y `Authorization`, no `sendBeacon`; **D28** frontend puede ver todos los logs de su propio `service`/`env`, sin filtro por usuario/sesión en MVP; **D30** sin requisitos legales/compliance adicionales para MVP.

**Criterios globales CA1-CA22**: CA1 ingesta válida devuelve `202`; CA2 lote devuelve conteos; CA3 inválidos no tumban lote parcial; CA4 cero válidos devuelve `400`; CA5 key inválida devuelve `401`; CA6 falta de scope devuelve `403`; CA7 service no autorizado no se escribe ni consulta; CA8 logs aparecen en stream esperado; CA9 consulta filtra por `service`, rango, `level`, `env`, `q`, `trace_id`, `request_id`; CA10 cursor opaco; CA11 SQL no vulnerable a inyección; CA12 límites de body, batch, campos, contexto y rate limit; CA13 health/readiness funcionan; CA14 no se exponen credenciales; CA15 existe `npm run keygen`; CA16 README completo; CA17 Dockerfile funcional; CA18 métricas Prometheus mínimas; CA19 `/services` devuelve capacidades de la key; CA20 restricciones frontend; CA21 campos sensibles redactados; CA22 tests automatizados cubren CA1-CA21.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Una aplicación con key `write` válida puede enviar un log válido y recibir `202`, apareciendo el evento en el stream esperado de OpenObserve (CA1, CA8).
- **SC-002**: El 100% de los criterios de aceptación globales CA1–CA21 quedan cubiertos por pruebas automatizadas (unit, integración o E2E) (CA22).
- **SC-003**: En un lote con registros válidos e inválidos, los inválidos no tumban el lote: se devuelven conteos y errores por índice y los válidos se aceptan (CA2, CA3); un lote sin válidos devuelve `400` (CA4).
- **SC-004**: Ninguna respuesta, log o documentación cliente expone credenciales de OpenObserve ni secretos de keys (CA14).
- **SC-005**: Los parámetros de usuario en consulta no permiten inyección SQL en ninguna combinación probada de `q`/`trace_id`/`request_id` (CA11).
- **SC-006**: Las keys frontend no pueden usar `q`, reciben respuesta reducida sin campos sensibles/conocidos en `context` y respetan los límites de 7 días y 500 resultados, con marcas `range_truncated`/`limit_truncated` cuando aplica (CA20).
- **SC-007**: Los límites de body comprimido/descomprimido, lote, campos, longitud de valores de `context`, rate limit y cola llena se aplican y devuelven los códigos `413`/`429` correspondientes (CA12).
- **SC-008**: `GET /api/v1/services` devuelve servicios, entornos, scopes y límites de la key actual sin filtrar secretos (CA19).
- **SC-009**: `GET /api/v1/metrics` expone las métricas mínimas de ingesta, rechazo, rate limit, fallos O2, cola, redacción y truncado en formato Prometheus (CA18).
- **SC-010**: Los campos sensibles y PII conocida por nombre de campo se enmascaran antes de enviarse a OpenObserve en el 100% de los casos con campos conocidos (CA21).
- **SC-011**: Liveness, readiness y métricas son públicos; readiness devuelve `503` cuando OpenObserve no está disponible y `200` cuando lo está (CA13).
- **SC-012**: Una key inválida recibe `401` y una key válida sin scope recibe `403`; un `service` no autorizado no se puede escribir ni consultar (CA5, CA6, CA7).
- **SC-013**: La consulta pagina con cursor opaco de forma estable, no devuelve `total` por defecto y filtra por `service`, rango, `level`, `env`, `q`, `trace_id` y `request_id` (CA9, CA10).
- **SC-014**: Existen `npm run keygen`, README completo y `Dockerfile` funcional (CA15, CA16, CA17).

## Assumptions

- El stack, versiones y arquitectura están fijados por `.specify/memory/constitution.md` (NestJS 11 + TypeScript 6, Node 24, Zod, Pino, prom-client, etc.); esta spec describe el QUÉ y el plan/implementación seguirán esas restricciones.
- El MVP usa entrega **best effort** con cola en memoria y **una sola réplica**; se acepta posible pérdida de logs en reinicios o caídas (D9, D10). La cola durable/DLQ queda fuera de alcance.
- Se usa una única organización OpenObserve (`O2_ORG`) y un stream por `service`, creado automáticamente en la primera ingesta.
- Las API keys frontend se consideran **públicas**; su seguridad se basa en alcance reducido, CORS, rate limit y revocabilidad, no en secreto.
- Visualización, dashboards, alertas e informes se hacen en la UI nativa de OpenObserve y quedan **fuera de alcance**.
- La redacción de PII se limita a enmascarado de campos sensibles o PII conocida por nombre de campo; no hay detección avanzada de PII en texto libre. Se permiten IDs técnicos e IPs completas.
- `GET /api/v1/logs` no devuelve `total` por defecto por coste potencial en OpenObserve; la paginación se basa en cursor opaco.
- Los límites de `Content-Encoding: gzip` se aplican tanto al body comprimido como al JSON descomprimido.
- `GET /api/v1/health`, `GET /api/v1/health/ready` y `GET /api/v1/metrics` son públicos.
- La retención `prod=90d`, `staging=30d`, `dev=30d`, `test=7d` es recomendación operativa inicial, no requisito funcional bloqueante.
- Autenticación contra OpenObserve mediante HTTP Basic (`O2_AUTH_USER`/`O2_AUTH_PASSWORD`); token opcional si la instalación lo permite.
- Los valores de entorno pendientes (dominio final E1, orígenes frontend E2, servicios iniciales E3) son placeholders a sustituir antes de desplegar y no bloquean la implementación.
- No existen requisitos legales/compliance adicionales para el MVP más allá de las políticas de seguridad y retención definidas (D30).
- El frontend usa `fetch` con `keepalive` y `Authorization`, no `sendBeacon` (D26).
- Los entregables incluyen snippets y documentación, no un SDK npm reutilizable (D24); las pruebas manuales se entregan como colección Postman (D25).
