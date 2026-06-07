# 📘 Manual de integración — Log Gateway API

![Versión del manual](https://img.shields.io/badge/Versión-1.2.0-blue)
![Versión de la API](https://img.shields.io/badge/API-1.0.0-green)
![Estado](https://img.shields.io/badge/Estado-Estable-success)
![Última actualización](https://img.shields.io/badge/Actualizado-2026--06--07-lightgrey)

> ℹ️ **Información del manual**
>
> **Versión del manual**: 1.2.0 · **API versión**: 1.0.0 · **Actualizado**: 2026-06-07
>
> Este manual cubre la integración completa con el Log Gateway API. Está dirigido a
> programadores que van a enviar logs desde sus aplicaciones o consultar logs de forma
> programática. No es necesario conocer OpenObserve ni la infraestructura interna para
> usar este manual; eso queda completamente oculto por el gateway.

---

## 📑 Tabla de contenidos

1. [¿Qué es el Log Gateway?](#1-qué-es-el-log-gateway)
  1. [¿Por qué existe este gateway?](#por-qué-existe-este-gateway)
2. [Conceptos clave antes de empezar](#2-conceptos-clave-antes-de-empezar)
  1. [Stream](#stream)
  2. [Service](#service)
  3. [Entorno (env)](#entorno-env)
  4. [API key](#api-key)
  5. [Best-effort](#best-effort)
3. [Primeros pasos — setup en 5 minutos](#3-primeros-pasos--setup-en-5-minutos)
  1. [3.1. Obtener la URL del gateway](#31-obtener-la-url-del-gateway)
  2. [3.2. Verificar que el servicio está activo](#32-verificar-que-el-servicio-está-activo)
  3. [3.3. Conseguir tu API key](#33-conseguir-tu-api-key)
  4. [3.4. Enviar tu primer log](#34-enviar-tu-primer-log)
4. [Autenticación con API keys](#4-autenticación-con-api-keys)
  1. [Formato del token](#formato-del-token)
  2. [Errores de autenticación](#errores-de-autenticación)
  3. [Scopes disponibles](#scopes-disponibles)
5. [Enviar logs — endpoint de ingesta](#5-enviar-logs--endpoint-de-ingesta)
  1. [`POST /api/v1/logs`](#post-apiv1logs)
    1. [Enviar un único evento](#enviar-un-único-evento)
    2. [Enviar varios eventos en un array](#enviar-varios-eventos-en-un-array)
    3. [Respuesta exitosa (202 Accepted)](#respuesta-exitosa-202-accepted)
    4. [Aceptación parcial](#aceptación-parcial)
    5. [Campos obligatorios y opcionales](#campos-obligatorios-y-opcionales)
  2. [Niveles de log](#niveles-de-log)
6. [Enviar lotes de logs](#6-enviar-lotes-de-logs)
  1. [`POST /api/v1/logs/batch`](#post-apiv1logsbatch)
    1. [Sin compresión](#sin-compresión)
    2. [Con compresión gzip](#con-compresión-gzip)
    3. [Diferencia entre /logs y /logs/batch](#diferencia-entre-logs-y-logsbatch)
7. [Consultar logs](#7-consultar-logs)
  1. [`GET /api/v1/logs`](#get-apiv1logs)
    1. [Ejemplo básico](#ejemplo-básico)
    2. [Ejemplo con filtros](#ejemplo-con-filtros)
    3. [Parámetros de consulta](#parámetros-de-consulta)
    4. [Respuesta exitosa (200 OK)](#respuesta-exitosa-200-ok)
    5. [Paginación con cursor](#paginación-con-cursor)
8. [Descubrir las capacidades de tu API key](#8-descubrir-las-capacidades-de-tu-api-key)
  1. [`GET /api/v1/services`](#get-apiv1services)
    1. [Respuesta de ejemplo (key backend)](#respuesta-de-ejemplo-key-backend)
    2. [Respuesta de ejemplo (key frontend)](#respuesta-de-ejemplo-key-frontend)
9. [Salud y disponibilidad del servicio](#9-salud-y-disponibilidad-del-servicio)
  1. [`GET /api/v1/health` — Liveness](#get-apiv1health--liveness)
  2. [`GET /api/v1/health/ready` — Readiness](#get-apiv1healthready--readiness)
10. [Métricas Prometheus](#10-métricas-prometheus)
  1. [`GET /api/v1/metrics`](#get-apiv1metrics)
    1. [Métricas disponibles](#métricas-disponibles)
    2. [Configuración para Prometheus (`scrape_config`)](#configuración-para-prometheus-scrape_config)
11. [Normalización y redacción automática](#11-normalización-y-redacción-automática)
  1. [Normalización de `level`](#normalización-de-level)
  2. [Timestamp automático](#timestamp-automático)
  3. [Normalización de `context`](#normalización-de-context)
  4. [Campos raíz desconocidos](#campos-raíz-desconocidos)
  5. [Redacción automática de datos sensibles](#redacción-automática-de-datos-sensibles)
12. [Límites y rate limiting](#12-límites-y-rate-limiting)
  1. [Rate limiting](#rate-limiting)
  2. [Límites de payload](#límites-de-payload)
  3. [Content-Type requerido](#content-type-requerido)
13. [Tipos de API key: backend vs frontend](#13-tipos-de-api-key-backend-vs-frontend)
  1. [Keys backend](#keys-backend)
  2. [Keys frontend](#keys-frontend)
    1. [Comparativa](#comparativa)
14. [Integración en aplicaciones Node.js / TypeScript (backend)](#14-integración-en-aplicaciones-nodejs--typescript-backend)
  1. [Uso básico del cliente backend](#uso-básico-del-cliente-backend)
  2. [Comportamiento del cliente backend](#comportamiento-del-cliente-backend)
  3. [Integración directa con curl / fetch (sin cliente)](#integración-directa-con-curl--fetch-sin-cliente)
15. [Integración en aplicaciones web (frontend)](#15-integración-en-aplicaciones-web-frontend)
  1. [Uso básico del cliente frontend](#uso-básico-del-cliente-frontend)
  2. [¿Por qué se usa `fetch` con `keepalive` y no `sendBeacon`?](#por-qué-se-usa-fetch-con-keepalive-y-no-sendbeacon)
  3. [Restricciones de las keys frontend](#restricciones-de-las-keys-frontend)
  4. [CORS](#cors)
16. [Formato de errores](#16-formato-de-errores)
  1. [Códigos de error principales](#códigos-de-error-principales)
  2. [Ejemplo de error `403`](#ejemplo-de-error-403)
  3. [Ejemplo de error `400` con detalle por índice (batch)](#ejemplo-de-error-400-con-detalle-por-índice-batch)
17. [Referencia completa de campos del LogEvent](#17-referencia-completa-de-campos-del-logevent)
18. [Referencia completa de endpoints](#18-referencia-completa-de-endpoints)
  1. [Resumen](#resumen)
  2. [Cabeceras comunes](#cabeceras-comunes)
  3. [`POST /api/v1/logs`](#post-apiv1logs-1)
  4. [`POST /api/v1/logs/batch`](#post-apiv1logsbatch-1)
  5. [`GET /api/v1/logs`](#get-apiv1logs-1)
  6. [`GET /api/v1/services`](#get-apiv1services-1)
  7. [`GET /api/v1/health`](#get-apiv1health-1)
  8. [`GET /api/v1/health/ready`](#get-apiv1healthready-1)
  9. [`GET /api/v1/metrics`](#get-apiv1metrics-1)
19. [Colección Postman](#19-colección-postman)
20. [Especificación OpenAPI e interfaz Swagger](#20-especificación-openapi-e-interfaz-swagger)
  1. [Swagger UI interactivo (disponible en todo momento)](#swagger-ui-interactivo-disponible-en-todo-momento)
    1. [Cómo autenticarte en la Swagger UI](#cómo-autenticarte-en-la-swagger-ui)
  2. [Spec en JSON y YAML (importable en herramientas)](#spec-en-json-y-yaml-importable-en-herramientas)
    1. [Importar en Postman desde URL (siempre actualizado)](#importar-en-postman-desde-url-siempre-actualizado)
    2. [Importar en Insomnia](#importar-en-insomnia)
    3. [Renderizar con ReDoc (documentación estática legible)](#renderizar-con-redoc-documentación-estática-legible)
  3. [Fichero de especificación manual (fuente normativa)](#fichero-de-especificación-manual-fuente-normativa)
  4. [Versiones instaladas](#versiones-instaladas)
21. [Preguntas frecuentes](#21-preguntas-frecuentes)
  1. [¿Qué pasa si el gateway está caído mientras mi app está enviando logs?](#qué-pasa-si-el-gateway-está-caído-mientras-mi-app-está-enviando-logs)
  2. [¿Puedo enviar logs de múltiples servicios con la misma key?](#puedo-enviar-logs-de-múltiples-servicios-con-la-misma-key)
  3. [¿Puedo crear mis propios streams o servicios?](#puedo-crear-mis-propios-streams-o-servicios)
  4. [¿Por qué recibo `403` al enviar un log con un `service` que creo tener autorizado?](#por-qué-recibo-403-al-enviar-un-log-con-un-service-que-creo-tener-autorizado)
  5. [¿Cuánto tiempo se guardan los logs?](#cuánto-tiempo-se-guardan-los-logs)
  6. [¿Cómo depuro un error sin `request_id`?](#cómo-depuro-un-error-sin-request_id)
  7. [¿Puedo enviar el token de API key de otra forma que no sea `Authorization: Bearer`?](#puedo-enviar-el-token-de-api-key-de-otra-forma-que-no-sea-authorization-bearer)
  8. [¿Los logs del gateway aparecen en OpenObserve?](#los-logs-del-gateway-aparecen-en-openobserve)
  9. [¿Qué significa `range_truncated: true` en la respuesta de consulta?](#qué-significa-range_truncated-true-en-la-respuesta-de-consulta)
  10. [¿Por qué no hay un campo `total` en la respuesta de consulta?](#por-qué-no-hay-un-campo-total-en-la-respuesta-de-consulta)
- [Apéndice: variables de entorno del gateway](#apéndice-variables-de-entorno-del-gateway)

---

## 1. ❓ ¿Qué es el Log Gateway?

El **Log Gateway** es un servicio HTTP centralizado que actúa de intermediario entre tus
aplicaciones y el sistema de almacenamiento de logs interno (OpenObserve). Sus
responsabilidades son:

- **Recibir logs** de tus aplicaciones (backend y frontend) de forma segura.
- **Validar y normalizar** los eventos antes de almacenarlos.
- **Enmascarar datos sensibles** (contraseñas, tokens, emails, IBANs…) de forma
  automática para que nunca lleguen al sistema de almacenamiento.
- **Aislar aplicaciones** — cada aplicación tiene su propia API key con permisos
  acotados: una app no puede leer ni escribir los logs de otra.
- **Exponer una API de consulta** segura para que las integraciones programáticas puedan
  recuperar logs con filtros, sin acceso directo al sistema de almacenamiento.
- **Proteger el sistema** mediante rate limiting, límites de tamaño y rechazo de
  payloads malformados.

### 🤔 ¿Por qué existe este gateway?

Sin el gateway, cada aplicación necesitaría las credenciales de OpenObserve. Con el
gateway, solo el propio servicio conoce esas credenciales. Las aplicaciones únicamente
necesitan una API key del gateway, que puede revocarse individualmente sin afectar al
resto.

```text
Tu aplicación  ──►  Log Gateway API  ──►  OpenObserve
                      (este servicio)        (almacenamiento,
                                               invisible para ti)
```

---

## 2. 🧠 Conceptos clave antes de empezar

### 🌊 Stream

Cada aplicación escribe en su propio **stream**. Un stream es un espacio de
almacenamiento aislado nombrado por el identificador del servicio (p. ej.
`payments_api`, `web_shop`). El gateway crea el stream automáticamente la primera vez
que recibe un log para ese servicio; no necesitas crear nada de antemano.

### 🛠️ Service

El campo `service` de cada log identifica qué aplicación lo generó y determina en qué
stream se almacena. Debe coincidir con uno de los servicios autorizados en tu API key.
El formato permitido es: solo letras minúsculas, dígitos y guion bajo, entre 3 y 64
caracteres (expresión regular: `^[a-z0-9_]{3,64}$`).

Ejemplos válidos: `payments_api`, `web_shop`, `auth_service`, `my_app`.

### 🏷️ Entorno (env)

Cada log pertenece a un entorno: `production`, `staging`, `development`, `test` (u
otros que configure el operador). Esto permite filtrar logs por entorno y aplicar
distintas políticas de retención.

### 🔑 API key

Es tu credencial de acceso al gateway. Cada API key tiene:

- **Servicios autorizados**: qué streams puede leer/escribir.
- **Scopes**: `write` (enviar logs), `read` (consultar logs), o ambos.
- **Tipo de cliente**: `backend` (confianza alta) o `frontend` (confianza reducida,
  key pública).

### ⏱️ Best-effort

El envío de logs es **best-effort**: el gateway acepta el log (`202 Accepted`), lo
encola en memoria y lo entrega a OpenObserve de forma asíncrona. En caso de
reinicio o caída del gateway, los logs en cola pueden perderse. Para logging de negocio
crítico usa siempre el sistema de persistencia principal de tu aplicación; este gateway
es para observabilidad.

---

## 3. 🚀 Primeros pasos — setup en 5 minutos

> 💡 **Consejo:** Si solo quieres integrar el gateway en tu aplicación y ya tienes una
> API key, salta directamente a la sección
> [4. Autenticación con API keys](#4-autenticación-con-api-keys).

### 🔗 3.1. Obtener la URL del gateway

El gateway está disponible en la URL que te proporcione el equipo de infraestructura.
En local (desarrollo) es `http://localhost:3366` (puerto configurable mediante la
variable de entorno `PORT`). En producción, una URL del tipo
`https://logs.tuempresa.com`.

### ❤️ 3.2. Verificar que el servicio está activo

```bash
curl https://logs.tuempresa.com/api/v1/health
# Respuesta esperada: { "status": "ok" }
```

Si obtienes `{ "status": "ok" }` el proceso HTTP está vivo. Para verificar que también
conecta con el almacenamiento interno:

```bash
curl https://logs.tuempresa.com/api/v1/health/ready
# Respuesta: { "status": "ready" }  ← todo correcto
# Respuesta: { "status": "not_ready" }  ← problema de conectividad
```

Ninguno de estos endpoints requiere autenticación.

### 🔐 3.3. Conseguir tu API key

Contacta al responsable de la plataforma para que genere una API key para tu
aplicación. El operador ejecuta:

```bash
npm run keygen
```

Esto produce:

```text
key_id:      key-a1b2c3d4e5f6
secret:      8f3k2j1m9n4q7r6s...
secret_hash: e3b0c44298fc1c14...
Bearer token: key-a1b2c3d4e5f6.8f3k2j1m9n4q7r6s...
```

El **Bearer token** es lo que debes configurar en tu aplicación. El `secret_hash`
lo usa el operador para configurar la key en el servidor; tú nunca lo ves ni lo
necesitas.

> ⚠️ **Importante:** guarda el Bearer token como un secreto. En backend, guárdalo en
> una variable de entorno. En frontend, trátalo como una credencial pública de bajo
> privilegio (solo puede escribir/leer logs de tu propio servicio).

### ✉️ 3.4. Enviar tu primer log

```bash
curl -X POST https://logs.tuempresa.com/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer key-a1b2c3d4e5f6.tu-secreto-aqui" \
  -d '{
    "service": "payments_api",
    "env": "production",
    "level": "info",
    "message": "Pago procesado correctamente"
  }'
```

Respuesta:

```json
{
  "accepted": 1,
  "rejected": 0,
  "request_id": "b7e2c9a1-4f3d-4b8e-a1c2-d3e4f5a6b7c8"
}
```

¡Listo! Tu log ya está en OpenObserve.

---

## 4. 🛡️ Autenticación y configuración de API keys

### 🎫 Formato del token

Todos los endpoints (salvo `/health`, `/health/ready` y `/metrics`) requieren
autenticación mediante un token Bearer en la cabecera `Authorization`.

El token tiene el formato `<key_id>.<secret>`, que debes enviar como:

```http
Authorization: Bearer key-a1b2c3d4e5f6.tu-secreto-aqui
```

El gateway separa el token por el primer punto, identifica la key por `key_id` y
verifica el secreto de forma segura (comparación en tiempo constante para evitar
timing attacks).

---

### ⚙️ Cómo crear una API key

Ejecuta en el servidor:

```bash
npm run keygen
```

La salida es similar a esta:

```
key_id:       key-0226d045f7ee104d
secret:       8f3k2j1m9n4q7r6s...        ← esto lo guarda el programador en su app
secret_hash:  69a566449bb47755...         ← esto va en tu configuración del gateway
Bearer token: key-0226d045f7ee104d.8f3k2j1m9n4q7r6s...
```

- El **`secret`** (y el Bearer token completo) se lo das al programador. Es lo que
  su aplicación incluirá en cada petición. Guárdalo bien porque no se puede
  recuperar después.
- El **`secret_hash`** es lo que tú configuras en el gateway. Nunca el secreto
  en claro, solo su hash SHA-256.

---

### 📋 Anatomía de una API key — qué significa cada campo

```json
{
  "id": "key-0226d045f7ee104d",
  "secret_hash": "69a566449bb47755...",
  "services": ["pruebas"],
  "scopes": ["write", "read"],
  "client_type": "backend",
  "allowed_origins": []
}
```

| Campo | Qué es | Ejemplo |
|---|---|---|
| `id` | Identificador único de la key. Lo genera `npm run keygen`. | `"key-0226d045f7ee104d"` |
| `secret_hash` | Hash SHA-256 del secreto. Lo genera `npm run keygen`. Nunca el secreto en claro. | `"69a566..."` |
| `services` | Lista de servicios (streams) a los que esta key puede acceder. | `["pagos", "tienda"]` |
| `scopes` | Qué puede hacer: `"write"` (enviar logs), `"read"` (consultar logs). | `["write"]` |
| `client_type` | `"backend"` (servidor) o `"frontend"` (navegador). Cambia los límites y restricciones. | `"backend"` |
| `allowed_origins` | Orígenes CORS permitidos. Solo relevante para keys frontend. Vacío = sin restricción CORS adicional. | `["https://miapp.com"]` |
| `envs` | (Opcional) Restringe a entornos concretos. Si se omite, permite todos los de `ALLOWED_ENVS`. | `["production"]` |

---

### 👥 Cómo configurar varias API keys

Si tienes varios programadores o varias aplicaciones, cada una tiene su propia key.
Todas van en el mismo array JSON.

Hay dos formas de proporcionar ese array al gateway:

#### Método A — Fichero `secrets/api-keys.json` con `API_KEYS_FILE` ✅ **Configuración activa**

Esta es la configuración que está usando el gateway actualmente. En el `.env`:

```env
API_KEYS_FILE=./secrets/api-keys.json
```

El fichero vive en `secrets/api-keys.json` dentro del proyecto y **nunca se sube a Git**
(el directorio `secrets/` está en `.gitignore`). Es un array JSON con saltos de línea y
sangría normal, fácil de editar:

```json
[
  {
    "id": "key-0226d045f7ee104d",
    "secret_hash": "69a566449bb47755985343f0d9812c69d002513289dc4eb53b8ec9d6f491dd9f",
    "services": ["pruebas"],
    "scopes": ["write", "read"],
    "client_type": "backend",
    "allowed_origins": []
  }
]
```

Para añadir una segunda key, añade un objeto más al array (con coma después del anterior):

```json
[
  {
    "id": "key-0226d045f7ee104d",
    "secret_hash": "69a566449bb47755985343f0d9812c69d002513289dc4eb53b8ec9d6f491dd9f",
    "services": ["pruebas"],
    "scopes": ["write", "read"],
    "client_type": "backend",
    "allowed_origins": []
  },
  {
    "id": "key-nueva-app",
    "secret_hash": "HASH_GENERADO_CON_npm_run_keygen",
    "services": ["nueva_app"],
    "scopes": ["write"],
    "client_type": "backend",
    "allowed_origins": []
  }
]
```

Después de editar el fichero, **reinicia el gateway** para que recargue las keys.

> **En producción con Docker**, el fichero se monta como volumen de solo lectura en el
> contenedor. Ver la sección `volumes` del `docker-compose.yaml`:
> ```yaml
> volumes:
>   - ./secrets/api-keys.json:/run/secrets/api-keys.json:ro
> ```
> Y la variable de entorno dentro del contenedor apunta a esa ruta:
> ```env
> API_KEYS_FILE=/run/secrets/api-keys.json
> ```

#### Método B — Variable `API_KEYS_JSON` en el `.env` (alternativa para desarrollo rápido)

Válido para pruebas rápidas o cuando solo hay una key. Es todo en una línea sin saltos:

```env
API_KEYS_JSON=[{"id":"key-pagos-001","secret_hash":"abc123...","services":["pagos"],"scopes":["write","read"],"client_type":"backend","allowed_origins":[]}]
```

> Este método se vuelve difícil de mantener con más de una o dos keys porque el JSON
> tiene que ir en una sola línea. Para entornos reales usa siempre el Método A.

---

### 🖥️ Backend vs 🌐 Frontend — qué key usar en cada caso

La diferencia entre ambos tipos no es cosmética: cambia los límites y las
restricciones que el gateway aplica automáticamente.

#### Keys de tipo `backend`

Úsalas cuando la aplicación que va a hacer las peticiones **es un servidor**:
una API Node.js, Python, PHP, Java, un script de monitorización, etc. La key
viaja en las variables de entorno del servidor y nunca es visible para el usuario.

```json
{
  "id": "key-api-pagos",
  "secret_hash": "...",
  "services": ["pagos_api"],
  "scopes": ["write", "read"],
  "client_type": "backend",
  "allowed_origins": []
}
```

- `allowed_origins: []` → vacío porque las llamadas servidor-a-servidor no pasan
  por CORS. El navegador no interviene.
- Puede tener `"write"` y `"read"` a la vez.
- Puede usar búsqueda de texto libre (`q`) en las consultas.
- Límite de consulta: hasta 1000 resultados.
- Puede consultar cualquier rango de fechas.
- Recibe la respuesta completa con todos los campos.

#### Keys de tipo `frontend`

Úsalas cuando la petición viene **del navegador del usuario** (JavaScript en una
web, app React, Vue, Angular, etc.). La key inevitablemente es visible en el código
del navegador, por eso el gateway aplica restricciones automáticas que limitan el
daño si alguien la encuentra.

```json
{
  "id": "key-tienda-web",
  "secret_hash": "...",
  "services": ["tienda"],
  "scopes": ["write"],
  "client_type": "frontend",
  "allowed_origins": ["https://tienda.miempresa.com"]
}
```

- `allowed_origins` → **obligatorio** para keys frontend. El gateway rechaza
  peticiones desde dominios que no estén en esta lista.
- Solo puede acceder al `service` y `env` que tenga autorizado, nada más.
- **No puede usar** el parámetro `q` (búsqueda de texto libre).
- Límite de consulta: máximo 500 resultados (aunque pidas más, se recorta).
- Ventana temporal máxima: 7 días (si pides más, se recorta y llega `range_truncated: true`).
- La respuesta elimina automáticamente campos sensibles del `context`.

#### Comparativa rápida

| Capacidad | `backend` | `frontend` |
|---|---|---|
| Dónde vive la key | Variable de entorno del servidor | Código JavaScript del navegador |
| CORS | No aplica (servidor a servidor) | `allowed_origins` obligatorio |
| Búsqueda de texto libre (`q`) | ✅ Sí | ❌ No |
| Límite de resultados | 1000 | 500 (se recorta si pides más) |
| Ventana temporal | Ilimitada | 7 días (se recorta si pides más) |
| Respuesta | Completa | Reducida (sin campos sensibles) |
| `services: ["*"]` en producción | ❌ Prohibido | ❌ Prohibido |

#### Ejemplo práctico de configuración real

Supón que tienes estas aplicaciones:

| Aplicación | Tipo | Puede hacer |
|---|---|---|
| API de pagos (backend Node.js) | backend | Escribir y leer logs de `pagos_api` |
| API de usuarios (backend Python) | backend | Escribir logs de `usuarios` |
| Panel de administración (React) | frontend | Escribir logs de `admin_panel` desde el navegador |
| Monitorización interna (script) | backend | Leer logs de todos los servicios |

Configuración para este escenario:

```json
[
  {
    "id": "key-pagos",
    "secret_hash": "HASH_1",
    "services": ["pagos_api"],
    "scopes": ["write", "read"],
    "client_type": "backend",
    "allowed_origins": []
  },
  {
    "id": "key-usuarios",
    "secret_hash": "HASH_2",
    "services": ["usuarios"],
    "scopes": ["write"],
    "client_type": "backend",
    "allowed_origins": []
  },
  {
    "id": "key-admin-panel-fe",
    "secret_hash": "HASH_3",
    "services": ["admin_panel"],
    "scopes": ["write"],
    "client_type": "frontend",
    "allowed_origins": ["https://admin.miempresa.com"]
  },
  {
    "id": "key-monitoring",
    "secret_hash": "HASH_4",
    "services": ["pagos_api", "usuarios", "admin_panel"],
    "scopes": ["read"],
    "client_type": "backend",
    "allowed_origins": []
  }
]
```

Este JSON iría en `secrets/api-keys.json`. Cada equipo recibe su propio Bearer token
(`key_id.secret`). Si un programador se va o una key se compromete, basta con eliminar
su entrada del fichero y reiniciar el gateway — los demás no se ven afectados.

---

### ⛔ Errores de autenticación

| Situación | Código HTTP | Código de error |
|---|---|---|
| Sin cabecera `Authorization` | `401` | `unauthorized` |
| Token sin punto (formato inválido) | `401` | `unauthorized` |
| `key_id` no existe | `401` | `unauthorized` |
| Secreto incorrecto | `401` | `unauthorized` |
| Key válida pero sin scope para la operación | `403` | `forbidden` |
| Key válida pero sin acceso al `service` solicitado | `403` | `forbidden` |

El gateway devuelve `401` tanto si el `key_id` no existe como si el secreto es
incorrecto — no distingue entre los dos casos para evitar que alguien pueda
enumerar qué keys existen.

### 🔓 Scopes disponibles

| Scope | Permite |
|---|---|
| `write` | Enviar logs (`POST /api/v1/logs`, `POST /api/v1/logs/batch`) |
| `read` | Consultar logs (`GET /api/v1/logs`) |

Una key puede tener uno o ambos scopes. `GET /api/v1/services` está disponible para
cualquier key autenticada independientemente del scope.

---

## 5. 📤 Enviar logs — endpoint de ingesta

### 📍 `POST /api/v1/logs`

Acepta un único evento o un array de eventos. Requiere scope `write`.

#### 1️⃣ Enviar un único evento

```bash
curl -X POST https://logs.tuempresa.com/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-token>" \
  -d '{
    "service": "payments_api",
    "env": "production",
    "level": "error",
    "message": "Error al procesar pago: tarjeta rechazada",
    "trace_id": "abc123",
    "request_id": "req-456",
    "context": {
      "payment_method": "card",
      "currency": "EUR",
      "amount": 49.99
    }
  }'
```

#### 🔢 Enviar varios eventos en un array

```bash
curl -X POST https://logs.tuempresa.com/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-token>" \
  -d '[
    {
      "service": "payments_api",
      "env": "production",
      "level": "info",
      "message": "Inicio de sesión de pago",
      "trace_id": "abc123"
    },
    {
      "service": "payments_api",
      "env": "production",
      "level": "error",
      "message": "Timeout al conectar con proveedor",
      "trace_id": "abc123"
    }
  ]'
```

#### ✅ Respuesta exitosa (`202 Accepted`)

```json
{
  "accepted": 2,
  "rejected": 0,
  "request_id": "b7e2c9a1-4f3d-4b8e-a1c2-d3e4f5a6b7c8"
}
```

#### ⚠️ Aceptación parcial

Si envías un array y algunos eventos son inválidos, los válidos se aceptan y los
inválidos se detallan en `errors`:

```json
{
  "accepted": 1,
  "rejected": 1,
  "errors": [
    {
      "index": 1,
      "code": "invalid_level",
      "message": "Level 'VERBOSE' no es un nivel válido"
    }
  ],
  "request_id": "b7e2c9a1-..."
}
```

El código HTTP es `202` siempre que haya al menos un registro aceptado. Si
ninguno es válido, la respuesta es `400 validation_error`.

#### 📋 Campos obligatorios y opcionales

| Campo | Obligatorio | Descripción |
|---|---|---|
| `service` | Sí | Identificador del servicio emisor |
| `env` | Sí | Entorno (`production`, `staging`, `development`, `test`) |
| `level` | Sí | Nivel de log (ver sección [Niveles](#niveles-de-log)) |
| `message` | Sí | Mensaje legible (máx. 4096 chars por defecto) |
| `_timestamp` | No | ISO-8601 o entero en microsegundos. Si falta, se usa la hora de recepción |
| `trace_id` | No | ID de traza distribuida |
| `span_id` | No | ID de span (OpenTelemetry) |
| `request_id` | No | ID de la petición HTTP que originó el log |
| `event_id` | No | ID único del evento (solo para trazabilidad; no hay deduplicación) |
| `hostname` | No | Hostname de la máquina emisora |
| `version` | No | Versión de la aplicación emisora |
| `source` | No | Origen: `backend` o `frontend`. Cualquier otro valor se normaliza a `unknown` |
| `context` | No | Objeto con metadatos adicionales (ver [Normalización de context](#normalización-de-context)) |

Cualquier campo adicional en la raíz del evento que no esté en la lista anterior se
mueve automáticamente a `context.extra`.

### 🔤 Niveles de log

El campo `level` acepta estos valores (en cualquier capitalización):

| Valor normalizado | Equivalencias aceptadas |
|---|---|
| `trace` | `trace` |
| `debug` | `debug` |
| `info` | `info` |
| `warn` | `warn`, `warning` |
| `error` | `error`, `err` |
| `fatal` | `fatal`, `critical` |

Un nivel desconocido (que no sea ninguna de las equivalencias anteriores) hace que el
registro se rechace con `invalid_level`.

---

## 6. 📦 Enviar lotes de logs

### 📍 `POST /api/v1/logs/batch`

Igual que `POST /api/v1/logs`, pero **exige** que el body sea un array. Adicionalmente
soporta compresión gzip. Requiere scope `write`.

Usa este endpoint cuando envíes grandes volúmenes de logs desde un buffer de tu
aplicación.

#### 📄 Sin compresión

```bash
curl -X POST https://logs.tuempresa.com/api/v1/logs/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-token>" \
  -d '[
    { "service": "web_shop", "env": "production", "level": "info", "message": "Evento A" },
    { "service": "web_shop", "env": "production", "level": "warn", "message": "Evento B" }
  ]'
```

#### 🗜️ Con compresión gzip

```bash
echo '[{"service":"web_shop","env":"production","level":"info","message":"Evento A"}]' \
  | gzip \
  | curl -X POST https://logs.tuempresa.com/api/v1/logs/batch \
    -H "Content-Type: application/json" \
    -H "Content-Encoding: gzip" \
    -H "Authorization: Bearer <tu-token>" \
    --data-binary @-
```

La compresión gzip es transparente. El gateway descomprime y procesa el JSON
internamente. El límite de tamaño (`INGEST_MAX_BODY_MB`) se aplica tanto al body
comprimido como al JSON descomprimido. Si cualquiera de los dos supera el límite,
recibes `413 payload_too_large`.

#### ⚖️ Diferencia entre `/logs` y `/logs/batch`

| | `POST /logs` | `POST /logs/batch` |
|---|---|---|
| Formato del body | Objeto único **o** array | Solo array |
| Compresión gzip | No | Sí (`Content-Encoding: gzip`) |
| Caso de uso | Eventos individuales, integración sencilla | Lotes, alto volumen, clientes con buffer |

---

## 7. 🔍 Consultar logs

### 📍 `GET /api/v1/logs`

Devuelve logs almacenados con filtros opcionales. Requiere scope `read`.

El parámetro `service` es **obligatorio**; sin él recibes `400 validation_error`.

#### 🧪 Ejemplo básico

```bash
curl "https://logs.tuempresa.com/api/v1/logs?service=payments_api" \
  -H "Authorization: Bearer <tu-token-con-scope-read>"
```

#### 🔍 Ejemplo con filtros

```bash
curl "https://logs.tuempresa.com/api/v1/logs?service=payments_api\
&level=error,warn\
&from=2026-06-01T00:00:00Z\
&to=2026-06-01T23:59:59Z\
&limit=50\
&sort=desc" \
  -H "Authorization: Bearer <tu-token-con-scope-read>"
```

#### 📋 Parámetros de consulta

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `service` | string | — | **Obligatorio**. Servicio a consultar |
| `from` | string (ISO-8601) | `now-1h` | Inicio del rango temporal |
| `to` | string (ISO-8601) | `now` | Fin del rango temporal |
| `level` | string | — | Uno o varios niveles separados por coma: `error,warn` |
| `env` | string | — | Filtrar por entorno |
| `q` | string | — | Búsqueda de texto libre en `message`. **Prohibido para keys frontend** |
| `trace_id` | string | — | Filtrar por ID de traza exacto |
| `request_id` | string | — | Filtrar por ID de request exacto |
| `limit` | integer | `100` | Número máximo de resultados (máx. `1000` para keys backend) |
| `cursor` | string | — | Cursor opaco de paginación (obtenido de una respuesta anterior) |
| `sort` | `asc` \| `desc` | `desc` | Orden temporal de resultados |
| `include_total` | boolean | `false` | Incluir total de resultados. Solo keys backend; operación costosa |

#### ✅ Respuesta exitosa (`200 OK`)

```json
{
  "items": [
    {
      "_timestamp": "2026-06-01T15:32:11.000Z",
      "service": "payments_api",
      "env": "production",
      "level": "error",
      "message": "Error al procesar pago: tarjeta rechazada",
      "trace_id": "abc123",
      "request_id": "req-456",
      "context": {
        "payment_method": "card",
        "currency": "EUR",
        "amount": 49.99
      }
    }
  ],
  "next_cursor": "eyJvZmZzZXQiOjEwMH0=",
  "range_truncated": false,
  "limit_truncated": false,
  "request_id": "b7e2c9a1-..."
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `items` | array | Array de eventos de log |
| `next_cursor` | string \| null | Cursor para la siguiente página. `null` si no hay más |
| `range_truncated` | boolean | `true` si el rango solicitado fue recortado (keys frontend) |
| `limit_truncated` | boolean | `true` si el `limit` fue recortado (keys frontend) |
| `request_id` | string | ID de la petición para trazabilidad |
| `total` | integer | Solo si `include_total=true` y key backend |

#### ⏭️ Paginación con cursor

Si `next_cursor` no es `null`, hay más resultados. Para obtener la siguiente página,
pasa el cursor en el parámetro `cursor`:

```bash
curl "https://logs.tuempresa.com/api/v1/logs?service=payments_api\
&cursor=eyJvZmZzZXQiOjEwMH0=" \
  -H "Authorization: Bearer <tu-token>"
```

El cursor es opaco (no lo interpretes ni lo construyas manualmente). Es estable para
la misma consulta y los mismos datos.

---

## 8. 🧭 Descubrir las capacidades de tu API key

### 📍 `GET /api/v1/services`

Devuelve qué servicios, entornos, scopes y límites tiene autorizados tu API key.
Es útil para que tu aplicación se autoconfigure o para depurar problemas de permisos.

```bash
curl https://logs.tuempresa.com/api/v1/services \
  -H "Authorization: Bearer <tu-token>"
```

#### 🖥️ Respuesta de ejemplo (key backend)

```json
{
  "services": ["payments_api", "auth_service"],
  "envs": ["production", "staging"],
  "scopes": ["write", "read"],
  "limits": {
    "max_query_window": null,
    "max_limit": 1000,
    "allow_q": true,
    "response_profile": "full"
  }
}
```

#### 🌐 Respuesta de ejemplo (key frontend)

```json
{
  "services": ["web_shop"],
  "envs": ["production"],
  "scopes": ["read"],
  "limits": {
    "max_query_window": "7d",
    "max_limit": 500,
    "allow_q": false,
    "response_profile": "frontend_reduced"
  }
}
```

La respuesta **nunca** incluye hashes de secretos ni información de otras keys.

---

## 9. 💓 Salud y disponibilidad del servicio

Estos dos endpoints son **públicos** (no requieren API key) y están pensados para
healthchecks de infraestructura, monitorización y balanceadores de carga.

### 💚 `GET /api/v1/health` — Liveness

Responde `200` siempre que el proceso HTTP esté vivo. **No comprueba** la
conectividad con el almacenamiento interno.

```bash
curl https://logs.tuempresa.com/api/v1/health
# { "status": "ok" }
```

Úsalo como **liveness probe** en Kubernetes / Coolify / Docker. Si este endpoint
falla, el contenedor está muerto y debe reiniciarse.

### 💛 `GET /api/v1/health/ready` — Readiness

Responde `200` si el servicio puede conectar con el almacenamiento interno y la
configuración es válida. Responde `503` si no.

```bash
curl https://logs.tuempresa.com/api/v1/health/ready
# { "status": "ready" }     → todo correcto
# { "status": "not_ready" } → problema de conectividad (503)
```

Úsalo como **readiness probe**. Si responde `503`, el servicio no debe recibir tráfico
hasta que se resuelva el problema de conectividad.

---

## 10. 📊 Métricas Prometheus

### 📍 `GET /api/v1/metrics`

Endpoint **público** que expone métricas en formato Prometheus (texto plano). Úsalo
para integrar el gateway con tu sistema de monitorización.

```bash
curl https://logs.tuempresa.com/api/v1/metrics
```

#### 📊 Métricas disponibles

| Métrica | Tipo | Descripción |
|---|---|---|
| `log_gateway_ingest_accepted_total` | Counter | Eventos aceptados en cola |
| `log_gateway_ingest_rejected_total` | Counter | Eventos rechazados por validación |
| `log_gateway_o2_delivery_failed_total` | Counter | Fallos de entrega al almacenamiento |
| `log_gateway_o2_delivery_retried_total` | Counter | Reintentos de entrega |
| `log_gateway_queue_depth` | Gauge | Eventos actualmente en la cola en memoria |
| `log_gateway_rate_limited_total` | Counter | Peticiones rechazadas por rate limit |
| `log_gateway_request_duration_seconds` | Histogram | Duración de las peticiones HTTP |
| `log_gateway_redacted_fields_total` | Counter | Campos sensibles redactados |
| `log_gateway_context_truncated_total` | Counter | Eventos con contexto truncado |

#### ⚙️ Configuración para Prometheus (`scrape_config`)

Añade esto a tu `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: log_gateway
    static_configs:
      - targets: ['log-gateway:3000']
    metrics_path: /api/v1/metrics
    scheme: http
    scrape_interval: 30s
```

---

## 11. 🧹 Normalización y redacción automática

El gateway procesa cada evento antes de almacenarlo. Este procesamiento es
**transparente** para el emisor pero tiene implicaciones en cómo aparecen los datos
en OpenObserve.

### 🔤 Normalización de `level`

El campo `level` se normaliza a minúsculas y se mapean las equivalencias comunes:

```text
"WARNING" → "warn"
"WARN"    → "warn"
"warning" → "warn"
"ERR"     → "error"
"err"     → "error"
"CRITICAL"→ "fatal"
"critical"→ "fatal"
"INFO"    → "info"
```

Si el valor resultante no es uno de `trace`, `debug`, `info`, `warn`, `error`, `fatal`,
el registro se rechaza con `invalid_level`.

### ⏰ Timestamp automático

Si no envías `_timestamp`, el gateway añade la hora exacta de recepción. Si lo envías,
acepta:

- ISO-8601: `"2026-06-01T15:32:11.000Z"`
- Microsegundos (int64): `1748779931000000`

### 🗂️ Normalización de `context`

El objeto `context` se aplana por puntos hasta `CONTEXT_MAX_DEPTH` niveles de
profundidad. Si un objeto `context` es demasiado profundo o tiene demasiados campos,
se recorta y el evento se marca con `context_truncated: true`. El evento sigue
aceptándose.

Ejemplo de aplanamiento:

```json
// Enviado:
{ "context": { "user": { "id": 42, "role": "admin" } } }

// Almacenado:
{ "context.user.id": 42, "context.user.role": "admin" }
```

### 🧩 Campos raíz desconocidos

Si envías un campo en la raíz del evento que no es un campo conocido del `LogEvent`,
el gateway lo mueve automáticamente a `context.extra`:

```json
// Enviado:
{ "service": "...", "level": "info", "message": "...", "my_custom_field": "valor" }

// Almacenado como:
{ "service": "...", "level": "info", "message": "...", "context": { "extra": { "my_custom_field": "valor" } } }
```

### 🛡️ Redacción automática de datos sensibles

El gateway enmascara automáticamente los valores de campos cuyo **nombre** coincida
con los nombres sensibles conocidos. El valor se sustituye por `***redacted***`.

Nombres de campo que se redactan automáticamente:

```text
password, token, authorization, cookie, set_cookie, secret,
api_key, credit_card, iban, email, phone, telephone,
dni, nif, full_name, address
```

Esta redacción opera sobre el **nombre del campo**, no sobre el contenido. Por
tanto:

- `{ "context": { "password": "mi-clave-secreta" } }` → `{ "context": { "password": "***redacted***" } }`
- `{ "context": { "user_iban": "ES91..." } }` → **no se redacta** (el nombre no es exactamente `iban`)
- `{ "message": "la contraseña es 1234" }` → **no se redacta** (detección en texto libre no está en el MVP)

> ✅ **Buena práctica:** nunca incluyas datos sensibles directamente en el campo
> `message`. Usa el objeto `context` con nombres de campo descriptivos que el gateway
> pueda redactar.

---

## 12. 🚧 Límites y rate limiting

### 🚦 Rate limiting

El gateway aplica un límite de peticiones por API key. Por defecto, el límite es
**100 peticiones por segundo** por key.

Si superas el límite, recibes `429 rate_limited`:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Demasiadas peticiones. Espera antes de reintentar."
  },
  "request_id": "..."
}
```

### 📏 Límites de payload

| Límite | Default | Descripción |
|---|---|---|
| `INGEST_MAX_BODY_MB` | 5 MB | Tamaño máximo del body (comprimido y descomprimido) |
| `INGEST_MAX_BATCH` | 1000 eventos | Máximo de eventos por lote |
| `LOG_MESSAGE_MAX_CHARS` | 8000 chars | Longitud máxima del campo `message` |
| `MAX_FIELDS_PER_RECORD` | 200 campos | Máximo de campos por evento (incluyendo context aplanado) |
| `CONTEXT_MAX_DEPTH` | 2 niveles | Profundidad máxima del objeto `context` |
| `CONTEXT_VALUE_MAX_CHARS` | 2000 chars | Longitud máxima de valores en `context` |
| `QUEUE_MAX_ITEMS` | 10000 | Máximo de eventos en la cola en memoria |

Superar `INGEST_MAX_BODY_MB` o `INGEST_MAX_BATCH` devuelve `413 payload_too_large`.

Superar `QUEUE_MAX_ITEMS` (cola llena) devuelve `429 rate_limited`.

### 📝 Content-Type requerido

Todos los endpoints de ingesta y consulta requieren `Content-Type: application/json`.
Un Content-Type no soportado devuelve `415 unsupported_media_type`.

---

## 13. 🏢 Tipos de API key: backend vs frontend

Las API keys tienen un tipo de cliente que determina sus capacidades y restricciones.

### 🖥️ Keys backend

- Confianza alta; se guardan como secreto en variables de entorno del servidor.
- Pueden tener scopes `write` y/o `read`.
- Pueden usar el parámetro `q` (búsqueda de texto libre) en consultas.
- Límite de consulta: hasta `1000` resultados.
- Pueden consultar cualquier rango temporal.
- Respuesta completa (todos los campos).

### 🌐 Keys frontend

- Confianza reducida; la key puede estar expuesta en el código del navegador.
- Su seguridad se basa en: alcance acotado a un único servicio/entorno, CORS,
  rate limiting y revocabilidad.
- Solo pueden leer/escribir su propio `service` y `env`.
- **No pueden usar** el parámetro `q`.
- Límite de consulta: máximo `500` resultados (si pides más, se recorta y se
  devuelve `limit_truncated: true`).
- Ventana temporal máxima de **7 días** (si pides más, se recorta y se devuelve
  `range_truncated: true`).
- Respuesta reducida: solo devuelven campos esenciales (`_timestamp`, `level`,
  `message`, `service`, `env`, `request_id`, `trace_id`) y un `context` sin
  campos sensibles conocidos.
- No pueden acceder al stream `log_gateway` (logs internos del propio gateway).

#### ⚖️ Comparativa

| Capacidad | Backend key | Frontend key |
|---|---|---|
| `scope: write` | Sí | Sí (si configurado) |
| `scope: read` | Sí | Sí (si configurado) |
| Parámetro `q` | Sí | No |
| `limit` máximo | 1000 | 500 |
| Ventana temporal máxima | Ilimitada | 7 días |
| Respuesta | Completa | Reducida (sin campos sensibles) |
| Acceso a `log_gateway` stream | No | No |
| `services: ["*"]` en producción | No | No |

---

## 14. ⚙️ Integración en aplicaciones Node.js / TypeScript (backend)

El directorio `docs/snippets/backend/` contiene un cliente de referencia listo para
usar. Cópialo a tu proyecto y adáptalo según tus necesidades.

### 🧰 Uso básico del cliente backend

```typescript
import { BackendLogClient } from './log-client'; // copia de docs/snippets/backend/log-client.ts

const logger = new BackendLogClient({
  baseUrl: process.env.LOG_GATEWAY_URL!,  // 'https://logs.tuempresa.com'
  apiKey:  process.env.LOG_GATEWAY_KEY!,  // 'key-abc123.tu-secreto'
  batchSize:       50,   // flush al acumular 50 eventos (opcional, default: 50)
  flushIntervalMs: 2000, // flush cada 2 segundos (opcional, default: 2000)
  timeoutMs:       3000, // timeout de red (opcional, default: 3000)
});

// Enviar un log
logger.log({
  service: 'payments_api',
  env:     'production',
  level:   'info',
  message: 'Pago procesado',
  trace_id: 'abc-123',
  context: { amount: 49.99, currency: 'EUR' },
});

// Al apagar el proceso, flush del buffer pendiente
process.on('beforeExit', async () => {
  await logger.flush();
  logger.destroy();
});
```

### 🔄 Comportamiento del cliente backend

- **Buffer en memoria**: los eventos se acumulan en un buffer local.
- **Flush automático**: se envía el lote cuando el buffer alcanza `batchSize` o
  transcurre `flushIntervalMs` (lo que ocurra primero).
- **Best-effort**: si el envío falla (red, timeout), el error se captura
  silenciosamente y **no se propaga** a tu lógica de negocio.
- El timer de flush usa `unref()` para no impedir el cierre natural del proceso.

### 🛠️ Integración directa con curl / fetch (sin cliente)

Si prefieres no usar el cliente, puedes enviar directamente con `fetch`:

```typescript
async function sendLog(event: object): Promise<void> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 3000);
    await fetch('https://logs.tuempresa.com/api/v1/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LOG_GATEWAY_KEY}`,
      },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    clearTimeout(tid);
  } catch {
    // Silencioso — el logging nunca debe romper tu aplicación
  }
}
```

---

## 15. 🎨 Integración en aplicaciones web (frontend)

El directorio `docs/snippets/frontend/` contiene un cliente de referencia para
navegadores modernos (ES2020+). Cópialo a tu proyecto.

### 🧰 Uso básico del cliente frontend

```typescript
import { FrontendLogClient } from './log-client'; // copia de docs/snippets/frontend/log-client.ts

const logger = new FrontendLogClient({
  baseUrl: 'https://logs.tuempresa.com',
  apiKey:  'key-frontend-abc123.tu-secreto-frontend', // key con client_type: frontend
  batchSize:       20,   // flush al acumular 20 eventos (opcional, default: 20)
  flushIntervalMs: 5000, // flush cada 5 segundos (opcional, default: 5000)
});

// Enviar un log de error de UI
logger.log({
  service: 'web_shop',
  env:     'production',
  level:   'error',
  message: 'Error al renderizar el carrito',
  source:  'frontend',
  context: { component: 'CartWidget', error_code: 'RENDER_FAIL' },
});

// Al desmontar la app (o en beforeunload)
window.addEventListener('beforeunload', () => logger.destroy());
```

### 🤔 ¿Por qué se usa `fetch` con `keepalive` y no `sendBeacon`?

El cliente frontend usa `fetch` con la opción `keepalive: true`. Esto permite que el
request sobreviva cuando el usuario navega a otra página o cierra la pestaña, similar
a `sendBeacon`. Se usa `fetch` en lugar de `sendBeacon` porque `sendBeacon` no permite
cabeceras personalizadas (como `Authorization`).

### ⚠️ Restricciones de las keys frontend

Recuerda que con una key frontend:

- Solo puedes escribir/leer logs de tu propio `service` y `env`.
- La consulta no admite el parámetro `q` (búsqueda de texto libre).
- La ventana máxima de consulta es 7 días.
- El límite máximo de resultados es 500.

### 🌐 CORS

Las keys tienen una lista de `allowed_origins`. El gateway aplica cabeceras CORS para
restringir desde qué dominios puede el navegador hacer peticiones. Si tu frontend
da un error CORS, contacta al operador para añadir tu dominio a la lista de orígenes
permitidos de tu key.

---

## 16. ❗ Formato de errores

Todas las respuestas de error siguen el mismo formato:

```json
{
  "error": {
    "code":    "string — código de error legible por máquina",
    "message": "string — descripción legible por humanos",
    "details": "opcional — detalles adicionales (array de errores por índice en lotes)"
  },
  "request_id": "string — ID único de la petición para depuración"
}
```

### Códigos de error principales

| Código HTTP | `error.code` | Causa |
|---|---|---|
| `400` | `validation_error` | JSON malformado, campos obligatorios ausentes, batch no-array, sin eventos válidos |
| `400` | `invalid_level` | El campo `level` no es un nivel conocido ni equivalente |
| `401` | `unauthorized` | Sin token, formato inválido, key no existe o secreto incorrecto |
| `403` | `forbidden` | Scope insuficiente, service no autorizado, restricción frontend |
| `413` | `payload_too_large` | Body supera `INGEST_MAX_BODY_MB` o lote supera `INGEST_MAX_BATCH` |
| `415` | `unsupported_media_type` | Content-Type no soportado |
| `429` | `rate_limited` | Superado `RATE_LIMIT_RPS` o cola en memoria llena |
| `502` | `openobserve_error` | OpenObserve falla en una consulta síncrona |

### Ejemplo de error `403`

```json
{
  "error": {
    "code":    "forbidden",
    "message": "La key no tiene scope 'read' para este servicio"
  },
  "request_id": "b7e2c9a1-4f3d-4b8e-a1c2-d3e4f5a6b7c8"
}
```

### Ejemplo de error `400` con detalle por índice (batch)

```json
{
  "error": {
    "code":    "validation_error",
    "message": "Ningún registro válido en el lote",
    "details": [
      { "index": 0, "code": "invalid_level",    "message": "Level 'VERBOSE' desconocido" },
      { "index": 1, "code": "validation_error", "message": "Campo 'service' obligatorio" }
    ]
  },
  "request_id": "..."
}
```

> 📌 **Nota:** siempre guarda el `request_id` cuando informes de un error al equipo
> de plataforma; permite localizar el evento exacto en los logs internos del gateway.

---

## 17. 📚 Referencia completa de campos del LogEvent

Esta es la estructura completa de un evento de log tal como se envía al gateway:

```typescript
interface LogEventInput {
  // ── Obligatorios ──────────────────────────────────────────────────────────
  service:  string;     // Patrón: ^[a-z0-9_]{3,64}$
  env:      string;     // 'production' | 'staging' | 'development' | 'test' | ...
  level:    string;     // 'trace'|'debug'|'info'|'warn'|'error'|'fatal' (o equivalencias)
  message:  string;     // Mín. 1 char, máx. LOG_MESSAGE_MAX_CHARS

  // ── Temporales ────────────────────────────────────────────────────────────
  _timestamp?: string | number;  // ISO-8601 o microsegundos. Default: hora de recepción

  // ── Trazabilidad ──────────────────────────────────────────────────────────
  event_id?:   string;  // ID único del evento (solo trazabilidad)
  trace_id?:   string;  // ID de traza distribuida
  span_id?:    string;  // ID de span (OpenTelemetry)
  request_id?: string;  // ID de la petición HTTP

  // ── Metadata de la aplicación ─────────────────────────────────────────────
  hostname?: string;    // Hostname de la máquina emisora
  version?:  string;    // Versión de la aplicación
  source?:   'backend' | 'frontend';  // Valor desconocido → 'unknown'

  // ── Contexto adicional ────────────────────────────────────────────────────
  context?: Record<string, unknown>;  // Objeto libre. Max CONTEXT_MAX_DEPTH niveles

  // ── Campos raíz extra ─────────────────────────────────────────────────────
  [key: string]: unknown;  // Se mueven a context.extra
}
```

---

## 18. 🗺️ Referencia completa de endpoints

### 📋 Resumen

| Método | Ruta | Auth | Scope | Descripción |
|---|---|---|---|---|
| `POST` | `/api/v1/logs` | Bearer | `write` | Ingestar un evento o array |
| `POST` | `/api/v1/logs/batch` | Bearer | `write` | Ingestar un lote (solo array, gzip opcional) |
| `GET` | `/api/v1/logs` | Bearer | `read` | Consultar logs con filtros |
| `GET` | `/api/v1/services` | Bearer | — | Capacidades de la key actual |
| `GET` | `/api/v1/health` | No | — | Liveness check |
| `GET` | `/api/v1/health/ready` | No | — | Readiness check |
| `GET` | `/api/v1/metrics` | No | — | Métricas Prometheus |

### 🏷️ Cabeceras comunes

```http
Content-Type:  application/json  (obligatoria en ingesta y consulta)
Authorization: Bearer <key_id>.<secret>  (obligatoria en todos los endpoints con Auth)
```

### 📍 `POST /api/v1/logs`

**Request body**: `LogEventInput` o `LogEventInput[]`

**Respuestas**:
- `202` — Al menos un evento aceptado. Body: `IngestResult`
- `400` — JSON inválido o ningún evento válido
- `401` — Key inválida o ausente
- `413` — Body demasiado grande
- `415` — Content-Type no soportado
- `429` — Rate limit superado o cola llena

### 📍 `POST /api/v1/logs/batch`

**Cabecera adicional** (opcional): `Content-Encoding: gzip`

**Request body**: `LogEventInput[]` (array obligatorio)

**Respuestas**: iguales que `POST /api/v1/logs`

### 📍 `GET /api/v1/logs`

**Query params**: `service` (obligatorio), `from`, `to`, `level`, `env`, `q`, `trace_id`,
`request_id`, `limit`, `cursor`, `sort`, `include_total`

**Respuestas**:
- `200` — Body: `QueryResult`
- `400` — `service` ausente u otros errores de validación
- `401` — Key inválida o ausente
- `403` — Sin scope `read` o service no autorizado
- `429` — Rate limit superado
- `502` — OpenObserve falló en la consulta

### 📍 `GET /api/v1/services`

**Respuestas**:
- `200` — Body: `ServicesInfo`
- `401` — Key inválida o ausente

### 📍 `GET /api/v1/health`

**Sin auth.** Responde `200 { "status": "ok" }` siempre que el proceso viva.

### 📍 `GET /api/v1/health/ready`

**Sin auth.** Responde `200 { "status": "ready" }` o `503 { "status": "not_ready" }`.

### 📍 `GET /api/v1/metrics`

**Sin auth.** Responde `200` con texto plano en formato Prometheus
(`Content-Type: text/plain`).

---

## 19. 📮 Colección Postman

La colección Postman está disponible en:

```text
postman/log-gateway.postman_collection.json
```

Para importarla:

1. Abre Postman.
2. Haz clic en **Import** → selecciona el fichero `log-gateway.postman_collection.json`.
3. Configura las variables de entorno en Postman:
   - `base_url`: URL del gateway (p. ej. `http://localhost:3000/api/v1`)
   - `write_key`: tu Bearer token con scope `write`
   - `read_key`: tu Bearer token con scope `read`

La colección incluye ejemplos de todos los endpoints con peticiones de muestra, casos
de error y los parámetros habituales precargados.

---

## 20. 📐 Especificación OpenAPI e interfaz Swagger

### 🖥️ Swagger UI interactivo (disponible en todo momento)

El gateway genera y sirve automáticamente la especificación OpenAPI 3.0 al arrancar.
Accede a la interfaz interactivo en:

```text
http://localhost:3366/api/docs          ← en desarrollo local
https://logs.tuempresa.com/api/docs     ← en producción
```

Desde la Swagger UI puedes:

- Ver todos los endpoints documentados con sus parámetros, schemas y ejemplos.
- Probar llamadas reales directamente desde el navegador ("Try it out").
- Autenticarte con tu API key para probar endpoints protegidos.

#### 🔐 Cómo autenticarte en la Swagger UI

1. Abre `/api/docs` en el navegador.
2. Haz clic en el botón **Authorize** (candado) en la esquina superior derecha.
3. En el campo `apiKey (http, Bearer)`, escribe tu Bearer token: `key-abc123.tu-secreto`.
4. Haz clic en **Authorize** y cierra el modal.
5. Ahora todos los "Try it out" enviarán automáticamente la cabecera `Authorization`.

La autorización se mantiene entre recargas gracias a la opción `persistAuthorization`.

### 📄 Spec en JSON y YAML (importable en herramientas)

El spec generado también está disponible en formatos descargables:

| URL | Formato | Uso |
|---|---|---|
| `/api/docs-json` | JSON | Importar en Postman desde URL |
| `/api/docs-yaml` | YAML | Importar en Insomnia, ReDoc, etc. |

#### 📮 Importar en Postman desde URL (siempre actualizado)

En lugar de usar el fichero estático de la colección, puedes apuntar Postman directamente
al endpoint de la spec para que se sincronice automáticamente con cualquier cambio:

1. Abre Postman → **Import**.
2. Selecciona la pestaña **Link**.
3. Pega la URL: `http://localhost:3366/api/docs-json` (o la URL de producción).
4. Haz clic en **Continue** → **Import**.

Postman importa todos los endpoints y genera una colección con ejemplos.
Cuando la API cambie, vuelve a importar desde la misma URL para actualizarla.

#### 📥 Importar en Insomnia

1. Abre Insomnia → **Create** → **Import from URL**.
2. Pega: `http://localhost:3366/api/docs-yaml`
3. Insomnia crea el workspace con todos los endpoints.

#### 🎨 Renderizar con ReDoc (documentación estática legible)

```bash
npx @redocly/cli preview-docs http://localhost:3366/api/docs-json
```

O descarga el YAML y renderiza offline:

```bash
curl http://localhost:3366/api/docs-yaml -o openapi.yaml
npx @redocly/cli preview-docs openapi.yaml
```

### 📜 Fichero de especificación manual (fuente normativa)

Además de la spec generada automáticamente, existe un fichero OpenAPI 3.1.0 mantenido
manualmente como contrato normativo del proyecto:

```text
specs/001-log-gateway-api/contracts/openapi.yaml
```

Este fichero es la **fuente de verdad del diseño** (contract-first). La spec generada
automáticamente refleja el código implementado; el fichero manual refleja el diseño
acordado. Si difieren, hay una discrepancia que el equipo debe resolver.

### 📦 Versiones instaladas

| Paquete | Versión |
|---|---|
| `@nestjs/swagger` | `11.4.4` |
| `swagger-ui-express` | `5.0.1` |
| `@types/swagger-ui-express` | `4.1.8` |

---

## 21. ❓ Preguntas frecuentes

### 💥 ¿Qué pasa si el gateway está caído mientras mi app está enviando logs?

Los logs se pierden. El gateway usa una cola en memoria: si el proceso se reinicia,
los eventos encolados pendientes de entrega a OpenObserve desaparecen. Por eso el
logging es **best-effort**. Nunca uses este gateway para eventos de negocio críticos
que no puedes permitirte perder; para eso usa tu base de datos o sistema de mensajería.

### 🧩 ¿Puedo enviar logs de múltiples servicios con la misma key?

Sí, si tu key tiene varios servicios autorizados (p. ej. `"services": ["payments_api",
"auth_service"]`). Cada evento se enruta al stream correcto según su campo `service`.

### 🌱 ¿Puedo crear mis propios streams o servicios?

No necesitas crearlos manualmente. El primer log que llega con un `service` nuevo
crea automáticamente el stream en OpenObserve. Eso sí, tu API key debe tener ese
`service` en su lista de servicios autorizados.

### 🚫 ¿Por qué recibo `403` al enviar un log con un `service` que creo tener autorizado?

Verifica con `GET /api/v1/services` qué servicios tiene autorizados tu key. El nombre
del `service` en el log debe coincidir **exactamente** con el configurado en la key
(mayúsculas/minúsculas incluidas, aunque el formato solo permite minúsculas).

### ⏳ ¿Cuánto tiempo se guardan los logs?

La retención depende del entorno y es configurable en OpenObserve por el operador.
Los valores recomendados por defecto son:

| Entorno | Retención recomendada |
|---|---|
| `production` | 90 días |
| `staging` | 30 días |
| `development` | 30 días |
| `test` | 7 días |

Consulta al equipo de plataforma para confirmar los valores actuales.

### 🐞 ¿Cómo depuro un error sin `request_id`?

Si la petición no llegó a procesarse (p. ej. timeout de red o caída del proceso), no
hay `request_id`. En ese caso, usa la hora aproximada del error y el nombre de tu
servicio para buscar en los logs internos del gateway (stream `log_gateway` en
OpenObserve, accesible solo para el equipo de plataforma).

### 🎫 ¿Puedo enviar el token de API key de otra forma que no sea `Authorization: Bearer`?

No. El único método de autenticación es la cabecera `Authorization: Bearer
<key_id>.<secret>`. No se admiten tokens en query string ni en cookies.

### 🔍 ¿Los logs del gateway aparecen en OpenObserve?

Sí. El propio gateway escribe sus logs internos en el stream `log_gateway` de
OpenObserve. Estos logs no incluyen secretos, payloads de cliente ni cabeceras
`Authorization`. Solo el equipo de plataforma tiene acceso a ese stream.

### ✂️ ¿Qué significa `range_truncated: true` en la respuesta de consulta?

Significa que el rango temporal que pediste fue recortado por el gateway. Esto ocurre
cuando usas una key de tipo frontend y pides datos de más de 7 días. Los resultados
devueltos corresponden a los últimos 7 días, no al rango original.

### 🔢 ¿Por qué no hay un campo `total` en la respuesta de consulta?

Calcular el total de resultados en OpenObserve puede ser costoso para grandes
volúmenes. Por defecto no se incluye. Si tienes una key backend y lo necesitas, añade
`include_total=true` a la query (puede ser lento con grandes datasets).

---

## Apéndice: 🔧 variables de entorno del gateway

Esta tabla es de referencia para operadores y para entender el comportamiento del
gateway cuando interactúas con él.

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP del servidor |
| `NODE_ENV` | `development` | Entorno del proceso |
| `O2_URL` | — | URL base de OpenObserve |
| `O2_ORG` | — | Organización en OpenObserve |
| `O2_AUTH_USER` | — | Usuario de OpenObserve |
| `O2_AUTH_PASSWORD` | — | Contraseña de OpenObserve (secreto) |
| `API_KEYS_JSON` | — | Array JSON de keys (o usar `API_KEYS_FILE`) |
| `API_KEYS_FILE` | — | Ruta a fichero JSON de keys |
| `ALLOWED_ENVS` | `prod,staging,dev,test` | Entornos válidos |
| `INGEST_MAX_BATCH` | `1000` | Máximo de eventos por lote |
| `INGEST_MAX_BODY_MB` | `5` | Tamaño máximo del body en MB |
| `LOG_MESSAGE_MAX_CHARS` | `8000` | Longitud máxima de `message` |
| `CONTEXT_MAX_DEPTH` | `2` | Profundidad máxima del `context` |
| `CONTEXT_VALUE_MAX_CHARS` | `2000` | Longitud máxima de valores de `context` |
| `MAX_FIELDS_PER_RECORD` | `200` | Máximo de campos por evento |
| `QUEUE_MAX_ITEMS` | `10000` | Capacidad de la cola en memoria |
| `RETRY_ATTEMPTS` | `3` | Intentos de reenvío a OpenObserve |
| `RETRY_BACKOFF_MS` | `200,1000,5000` | Backoff entre reintentos (ms) |
| `DELIVERY_BATCH_MAX` | `500` | Tamaño del lote de entrega al almacenamiento |
| `DELIVERY_FLUSH_MS` | `1000` | Intervalo de flush del worker (ms) |
| `RATE_LIMIT_RPS` | `100` | Peticiones por segundo por key |
| `CORS_ALLOWED_ORIGINS` | — | Orígenes CORS permitidos (coma-separados) |
| `LOG_LEVEL` | `info` | Nivel de logs del propio gateway |
| `METRICS_ENABLED` | `true` | Activar endpoint `/metrics` |

---

> 📌 **Mantenimiento de este manual**
>
> Este manual debe actualizarse cuando:
> - Se añadan, eliminen o modifiquen endpoints de la API.
> - Cambien los campos del `LogEvent` o los parámetros de consulta.
> - Se modifiquen los límites por defecto o el comportamiento de normalización/redacción.
> - Se añadan nuevos tipos de API key o scopes.
> - Cambie el formato de errores o los códigos de error.
>
> La fuente normativa es `specs/001-log-gateway-api/spec.md`. Si el manual y la spec
> entran en conflicto, la spec es la referencia correcta. Para actualizar el manual,
> revisa los cambios en spec.md y refleja aquí los que afecten al comportamiento
> observable por los consumidores de la API.
