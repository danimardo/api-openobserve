# Especificación: MCP Server de OpenObserve para Agentes de IA

**Versión**: 1.0  
**Stack**: Node.js ≥ 22 · TypeScript · `@modelcontextprotocol/sdk`  
**Propósito**: servidor MCP que permite a cualquier agente de IA consultar los logs almacenados en OpenObserve para depurar aplicaciones en tiempo real, sin que el desarrollador tenga que copiar ni pegar nada.

---

## Contexto y flujo de uso

```
Aplicación en desarrollo
        │  (envía logs vía Pino transport o API directa)
        ▼
API de ingesta de OpenObserve
        │
        ▼
OpenObserve (almacenamiento y búsqueda de logs)
        │
        ▼
MCP Server de OpenObserve   ◄──── este servidor
        │
        ▼
Agente de IA (Claude Code, Claude Desktop, etc.)
        │
        ▼
Desarrollador
```

El desarrollador le dice al agente: *"busca los errores del servicio `payments-api` de la última hora"*. El agente llama al MCP, que consulta OpenObserve y devuelve los logs formateados. El agente los analiza y da una respuesta concreta.

---

## Stack técnico y dependencias

```bash
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript @types/node tsx
```

| Paquete | Versión mínima | Para qué |
|---|---|---|
| `@modelcontextprotocol/sdk` | ^1.0.0 | Servidor MCP y transporte stdio |
| `zod` | ^3.0.0 | Validación de parámetros de cada tool |
| `tsx` | ^4.0.0 | Ejecutar TypeScript directamente (dev/producción local) |

No se necesita ningún framework HTTP. El servidor se comunica con el agente por **stdio** (proceso hijo).

---

## Estructura del proyecto

```
mcp-openobserve/
├── src/
│   ├── index.ts          # Punto de entrada: crea el servidor y conecta el transporte
│   ├── client.ts         # Clase OpenObserveClient: hace las peticiones HTTP a la API
│   └── tools/
│       ├── get-logs.ts
│       ├── search-logs.ts
│       ├── list-services.ts
│       └── get-error-summary.ts
├── package.json
└── tsconfig.json
```

---

## Variables de entorno

Todas obligatorias salvo las indicadas como opcionales.

| Variable | Descripción | Ejemplo |
|---|---|---|
| `OO_URL` | URL base de la instancia de OpenObserve | `https://openobserve.tudominio.com` |
| `OO_ORG` | Organización en OpenObserve | `default` |
| `OO_STREAM` | Nombre del stream/índice donde se almacenan los logs | `logs` |
| `OO_USER` | Usuario para autenticación Basic | `admin@example.com` |
| `OO_PASSWORD` | Contraseña para autenticación Basic | `secreto` |
| `OO_DEFAULT_LIMIT` | (Opcional) Número máximo de logs por defecto | `50` |
| `OO_DEFAULT_SINCE` | (Opcional) Ventana de tiempo por defecto | `1h` |

La autenticación contra OpenObserve usa **HTTP Basic Auth** (`OO_USER:OO_PASSWORD`). El servidor MCP no expone estas credenciales al agente.

---

## Herramientas (Tools) expuestas

### 1. `get_logs`

Recupera los logs más recientes de un servicio con filtros opcionales.

**Cuándo lo usa el agente**: cuando el desarrollador dice *"muéstrame los últimos logs de X"*, *"qué está pasando en el servicio Y"*, *"hay algún error en Z"*.

**Parámetros:**

| Nombre | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `service` | `string` | Sí | Nombre del servicio (campo `service` en el log) |
| `level` | `"trace" \| "debug" \| "info" \| "warn" \| "error" \| "fatal"` | No | Filtrar por nivel mínimo |
| `limit` | `number` (1–500) | No | Número de logs a devolver. Default: `OO_DEFAULT_LIMIT` |
| `since` | `string` | No | Ventana de tiempo hacia atrás: `"15m"`, `"1h"`, `"6h"`, `"24h"`, `"7d"`. Default: `OO_DEFAULT_SINCE` |

**Query SQL generada internamente:**

```sql
SELECT _timestamp, level, message, service, env, request_id, err
FROM "{stream}"
WHERE service = '{service}'
  [AND level IN ('warn','error','fatal')]   -- si se filtra por nivel
ORDER BY _timestamp DESC
LIMIT {limit}
```

**Respuesta al agente** (texto plano, una línea por log):

```
[2026-06-07T10:23:11.000Z] ERROR  Payment processing failed {"err":{"message":"Timeout","stack":"..."}, "request_id":"req-abc"}
[2026-06-07T10:23:10.000Z] INFO   Order received {"order_id":"ord-001","amount":99.99}
```

---

### 2. `search_logs`

Busca logs de un servicio usando texto libre (se traduce internamente a SQL `LIKE`).

**Cuándo lo usa el agente**: cuando el desarrollador dice *"busca logs que contengan 'timeout'"*, *"hay algún log relacionado con el usuario ID 42"*.

**Parámetros:**

| Nombre | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `service` | `string` | Sí | Nombre del servicio |
| `query` | `string` | Sí | Texto a buscar (se aplica sobre el campo `message` y los campos de contexto) |
| `limit` | `number` (1–200) | No | Default: `OO_DEFAULT_LIMIT` |
| `since` | `string` | No | Default: `OO_DEFAULT_SINCE` |

**Query SQL generada internamente:**

```sql
SELECT _timestamp, level, message, service, env, request_id
FROM "{stream}"
WHERE service = '{service}'
  AND match_all('{query}')
ORDER BY _timestamp DESC
LIMIT {limit}
```

> OpenObserve soporta `match_all()` para búsqueda full-text sobre todos los campos indexados.

**Respuesta al agente**: igual que `get_logs`.

---

### 3. `list_services`

Lista los servicios que han generado logs en la ventana de tiempo indicada, con el número de logs de cada uno.

**Cuándo lo usa el agente**: cuando el desarrollador pregunta *"qué servicios están logueando"*, *"qué aplicaciones tienen logs en el sistema"*.

**Parámetros:**

| Nombre | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `since` | `string` | No | Ventana de tiempo. Default: `"24h"` |

**Query SQL generada internamente:**

```sql
SELECT service, COUNT(*) as total, 
       COUNT(CASE WHEN level = 'error' THEN 1 END) as errors,
       COUNT(CASE WHEN level = 'fatal' THEN 1 END) as fatals
FROM "{stream}"
GROUP BY service
ORDER BY total DESC
```

**Respuesta al agente:**

```
Servicios activos (últimas 24h):
- payments-api     1.243 logs   12 errores   0 fatales
- user-service       847 logs    3 errores   0 fatales
- api-gateway        312 logs    0 errores   0 fatales
```

---

### 4. `get_error_summary`

Devuelve un resumen de los errores recientes de un servicio, agrupados por mensaje para detectar errores repetidos.

**Cuándo lo usa el agente**: cuando el desarrollador dice *"¿cuáles son los errores más frecuentes de X?"*, *"hay algo que se esté repitiendo en los logs de error"*.

**Parámetros:**

| Nombre | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `service` | `string` | Sí | Nombre del servicio |
| `since` | `string` | No | Default: `"1h"` |
| `limit` | `number` (1–50) | No | Top N errores más frecuentes. Default: `10` |

**Query SQL generada internamente:**

```sql
SELECT message, COUNT(*) as occurrences, MAX(_timestamp) as last_seen
FROM "{stream}"
WHERE service = '{service}'
  AND level IN ('error', 'fatal')
GROUP BY message
ORDER BY occurrences DESC
LIMIT {limit}
```

**Respuesta al agente:**

```
Errores más frecuentes en payments-api (última 1h):

 1. [23 veces] "Connection timeout to database"        último: 10:23:11
 2.  [8 veces] "Payment gateway returned 503"          último: 10:19:44
 3.  [2 veces] "Invalid JWT signature"                 último: 09:58:02
```

---

## Implementación del servidor

### `src/index.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OpenObserveClient } from './client.js';
import { registerGetLogs } from './tools/get-logs.js';
import { registerSearchLogs } from './tools/search-logs.js';
import { registerListServices } from './tools/list-services.js';
import { registerGetErrorSummary } from './tools/get-error-summary.js';

const client = new OpenObserveClient({
  url: process.env.OO_URL!,
  org: process.env.OO_ORG!,
  stream: process.env.OO_STREAM!,
  user: process.env.OO_USER!,
  password: process.env.OO_PASSWORD!,
});

const server = new McpServer({
  name: 'openobserve-logs',
  version: '1.0.0',
});

registerGetLogs(server, client);
registerSearchLogs(server, client);
registerListServices(server, client);
registerGetErrorSummary(server, client);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('MCP server fatal error:', err);
  process.exit(1);
});
```

---

### `src/client.ts`

```typescript
export interface OpenObserveConfig {
  url: string;
  org: string;
  stream: string;
  user: string;
  password: string;
}

export interface SearchQuery {
  sql: string;
  start_time: number; // microsegundos
  end_time: number;   // microsegundos
}

export class OpenObserveClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly stream: string;

  constructor(private readonly config: OpenObserveConfig) {
    this.baseUrl = `${config.url}/api/${config.org}`;
    this.authHeader = 'Basic ' + Buffer.from(`${config.user}:${config.password}`).toString('base64');
    this.stream = config.stream;
  }

  get streamName() { return this.stream; }

  async search(query: SearchQuery): Promise<Record<string, unknown>[]> {
    const url = `${this.baseUrl}/${this.stream}/_search`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
      },
      body: JSON.stringify({ query, from: 0, size: 500 }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`OpenObserve query failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as { hits?: Record<string, unknown>[] };
    return data.hits ?? [];
  }
}

// Convierte "15m", "1h", "6h", "24h", "7d" a microsegundos Unix
export function sinceToRange(since: string): { start_time: number; end_time: number } {
  const now = Date.now() * 1000; // ms → µs
  const units: Record<string, number> = { m: 60, h: 3600, d: 86400 };
  const match = since.match(/^(\d+)([mhd])$/);
  if (!match) throw new Error(`Formato de tiempo inválido: "${since}". Usa "15m", "1h", "24h", "7d".`);
  const [, n, unit] = match;
  const seconds = parseInt(n!) * (units[unit!] ?? 60);
  return { start_time: now - seconds * 1_000_000, end_time: now };
}
```

---

### `src/tools/get-logs.ts` (ejemplo de implementación de un tool)

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OpenObserveClient } from '../client.js';
import { sinceToRange } from '../client.js';

const LEVEL_ORDER = ['trace','debug','info','warn','error','fatal'];

export function registerGetLogs(server: McpServer, client: OpenObserveClient) {
  server.registerTool(
    'get_logs',
    {
      description: 'Recupera los logs más recientes de un servicio. Usa "level" para filtrar por severidad y "since" para limitar la ventana temporal.',
      inputSchema: z.object({
        service: z.string().describe('Nombre del servicio (campo service del log)'),
        level: z.enum(['trace','debug','info','warn','error','fatal']).optional()
          .describe('Nivel mínimo de log a incluir'),
        limit: z.number().int().min(1).max(500).optional().default(50)
          .describe('Número de logs a devolver (máx 500)'),
        since: z.string().optional().default('1h')
          .describe('Ventana de tiempo: "15m", "1h", "6h", "24h", "7d"'),
      }),
    },
    async ({ service, level, limit, since }) => {
      const range = sinceToRange(since);
      const levelsToInclude = level
        ? LEVEL_ORDER.slice(LEVEL_ORDER.indexOf(level)).map(l => `'${l}'`).join(',')
        : null;

      const levelClause = levelsToInclude ? `AND level IN (${levelsToInclude})` : '';
      const sql = `
        SELECT _timestamp, level, message, service, env, request_id, err
        FROM "${client.streamName}"
        WHERE service = '${service.replace(/'/g, "''")}' ${levelClause}
        ORDER BY _timestamp DESC
        LIMIT ${limit}
      `.trim();

      const hits = await client.search({ sql, ...range });

      if (hits.length === 0) {
        return { content: [{ type: 'text', text: `No se encontraron logs para el servicio "${service}" en los últimos ${since}.` }] };
      }

      const lines = hits.map(h => {
        const ts = new Date(Number(h['_timestamp']) / 1000).toISOString();
        const lvl = String(h['level'] ?? '').toUpperCase().padEnd(5);
        const msg = String(h['message'] ?? h['msg'] ?? '');
        const extra: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(h)) {
          if (!['_timestamp','level','message','msg','service','env'].includes(k) && v !== null && v !== undefined) {
            extra[k] = v;
          }
        }
        const extraStr = Object.keys(extra).length ? ' ' + JSON.stringify(extra) : '';
        return `[${ts}] ${lvl} ${msg}${extraStr}`;
      });

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );
}
```

Los demás tools (`search-logs`, `list-services`, `get-error-summary`) siguen el mismo patrón: `server.registerTool(nombre, { description, inputSchema }, handlerAsync)`.

---

## Registro en Claude Code

Añade el servidor al fichero `.claude/mcp.json` del proyecto (o en `~/.claude/mcp.json` para disponibilidad global):

```json
{
  "mcpServers": {
    "openobserve": {
      "command": "node",
      "args": ["--import", "tsx/esm", "/ruta/absoluta/mcp-openobserve/src/index.ts"],
      "env": {
        "OO_URL": "https://openobserve.tudominio.com",
        "OO_ORG": "default",
        "OO_STREAM": "logs",
        "OO_USER": "admin@example.com",
        "OO_PASSWORD": "tu-contraseña",
        "OO_DEFAULT_LIMIT": "50",
        "OO_DEFAULT_SINCE": "1h"
      }
    }
  }
}
```

Si el servidor está compilado a JavaScript:

```json
{
  "mcpServers": {
    "openobserve": {
      "command": "node",
      "args": ["/ruta/absoluta/mcp-openobserve/dist/index.js"],
      "env": { ... }
    }
  }
}
```

---

## Registro en Claude Desktop

Añade la misma configuración en `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "openobserve": {
      "command": "node",
      "args": ["--import", "tsx/esm", "/ruta/absoluta/mcp-openobserve/src/index.ts"],
      "env": {
        "OO_URL": "https://openobserve.tudominio.com",
        "OO_ORG": "default",
        "OO_STREAM": "logs",
        "OO_USER": "admin@example.com",
        "OO_PASSWORD": "tu-contraseña"
      }
    }
  }
}
```

---

## Ejemplos de uso por el agente

Una vez registrado el MCP, el agente puede responder a instrucciones como:

| Instrucción del desarrollador | Tool que usa el agente |
|---|---|
| *"¿Qué está pasando en payments-api?"* | `get_logs(service="payments-api")` |
| *"Muéstrame solo los errores de user-service de la última hora"* | `get_logs(service="user-service", level="error", since="1h")` |
| *"¿Hay algún log relacionado con el pedido ord-9912?"* | `search_logs(service="shop-api", query="ord-9912")` |
| *"¿Qué servicios están activos hoy?"* | `list_services(since="24h")` |
| *"¿Cuáles son los errores más frecuentes de api-gateway?"* | `get_error_summary(service="api-gateway")` |

---

## Consideraciones de seguridad

- Las credenciales de OpenObserve viajan en las variables de entorno del proceso MCP, no en las llamadas del agente.
- El agente **nunca** ve ni puede extraer `OO_USER` ni `OO_PASSWORD`.
- El MCP no expone ninguna operación de escritura: solo puede leer.
- Las queries SQL se construyen con escapado básico de comillas simples (`'` → `''`). Si se necesita mayor robustez, sustituir por queries parametrizadas si la versión de OpenObserve las soporta.
- Se recomienda crear un usuario de OpenObserve con permisos de **solo lectura** específicamente para este MCP.
