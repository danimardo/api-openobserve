# Guía: Reenvío de logs de Pino a OpenObserve vía API

**Stack**: Node.js ≥ 22 · TypeScript · Pino ≥ 7 · NestJS (opcional)
**Propósito**: añadir un transporte secundario a Pino para que cada log emitido por la aplicación sea también enviado al sistema centralizado de logs a través de la API REST de OpenObserve.

---

## Cómo funciona

Pino soporta múltiples transportes simultáneos mediante `pino.transport({ targets: [...] })`. Cada transporte corre en un **worker thread** separado, por lo que el rendimiento del proceso principal no se ve afectado. El transporte de OpenObserve recibe cada línea de log como objeto JSON, mapea sus campos al formato de la API y lanza un `POST` de forma asíncrona.

---

## Dependencias necesarias

`pino-abstract-transport` ya forma parte del árbol de dependencias de `pino` ≥ 7. Si quieres añadirla de forma explícita:

```bash
npm install pino-abstract-transport
```

No se necesita ninguna otra dependencia adicional. `fetch` está disponible de forma nativa desde Node.js 18.

---

## Variables de entorno

Añade estas tres variables al esquema de configuración de la aplicación. Las tres son **opcionales**: si alguna falta, el transporte simplemente no se activa.

| Variable | Descripción | Ejemplo |
|---|---|---|
| `OO_FORWARDER_URL` | URL del endpoint de ingesta de la API | `https://logs.tudominio.com/api/v1/logs` |
| `OO_FORWARDER_KEY` | Bearer token para autenticarse en la API | `key-xxxx.yyyy` |
| `OO_FORWARDER_SERVICE` | Nombre del servicio que se mostrará en los logs | `backend`, `payments-api`, etc. |

El campo `env` se toma automáticamente de `NODE_ENV`.

---

## Implementación

### 1. Fichero del transporte

Crea `src/infrastructure/logging/openobserve.transport.ts` (o la ruta equivalente en tu proyecto):

```typescript
import build from 'pino-abstract-transport';

const PINO_LEVEL: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

interface TransportOptions {
  url: string;
  apiKey: string;
  service: string;
  env: string;
}

export default async function openobserveTransport(opts: TransportOptions) {
  const { url, apiKey, service, env } = opts;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  return build(async function (source) {
    for await (const obj of source) {
      const log = obj as Record<string, unknown>;
      const { level, msg, pid, hostname, ...rest } = log;

      const body = JSON.stringify({
        service,
        env,
        level: PINO_LEVEL[level as number] ?? 'info',
        message: msg,
        ...rest,  // request_id, trace_id, module, campos de negocio, etc.
      });

      // Fire-and-forget: no se bloquea esperando respuesta de la API
      fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(5000),
      }).catch(() => {
        // Los errores de red nunca deben afectar al logging de la aplicación
      });
    }
  });
}
```

**Qué hace cada parte:**
- `build(...)` de `pino-abstract-transport` recibe el stream del worker de Pino.
- El bucle `for await` procesa cada línea de log ya parseada como objeto JSON.
- `pid` y `hostname` se descartan porque no aportan valor en un sistema centralizado.
- Todos los campos de contexto adicionales (`...rest`) se reenvían tal cual a la API.
- El `fetch` es fire-and-forget: la latencia de red no afecta al procesamiento del siguiente log.
- `AbortSignal.timeout(5000)` evita que requests colgados acumulen memoria.

---

### 2. Configuración en NestJS (`logging.module.ts`)

Añade `import path from 'path'` en el módulo de logging. Luego incorpora estas dos funciones helper y modifica el `useFactory`:

```typescript
import path from 'path';

type TransportTarget = { target: string; options?: Record<string, unknown>; level: string };

function buildForwarderTarget(cfg: AppConfigService, level: string): TransportTarget | null {
  const { OO_FORWARDER_URL, OO_FORWARDER_KEY, OO_FORWARDER_SERVICE, NODE_ENV } = cfg.env;
  if (!OO_FORWARDER_URL || !OO_FORWARDER_KEY || !OO_FORWARDER_SERVICE) return null;
  return {
    // path.join(__dirname, ...) resuelve al .js compilado en dist/
    target: path.join(__dirname, 'openobserve.transport'),
    options: {
      url: OO_FORWARDER_URL,
      apiKey: OO_FORWARDER_KEY,
      service: OO_FORWARDER_SERVICE,
      env: NODE_ENV,
    },
    level,
  };
}

function buildTransport(cfg: AppConfigService, level: string): { targets: TransportTarget[] } | undefined {
  const isProd = cfg.env.NODE_ENV === 'production';
  const forwarder = buildForwarderTarget(cfg, level);

  if (isProd) {
    // En producción solo activamos el transporte si el forwarder está configurado.
    // Si no, dejamos que Pino escriba a stdout por defecto (sin transport config).
    if (!forwarder) return undefined;
    return {
      targets: [
        { target: 'pino/file', options: { destination: 1 }, level }, // stdout
        forwarder,
      ],
    };
  }

  // En desarrollo mantenemos los destinos locales (consola + ficheros) y añadimos el forwarder si está configurado.
  const targets: TransportTarget[] = [
    { target: 'pino-pretty', options: { colorize: true, singleLine: true }, level },
    { target: 'pino/file', options: { destination: '.logs/app.jsonl' }, level },
    { target: 'pino-pretty', options: { colorize: false, singleLine: false, destination: '.logs/app.log' }, level },
  ];
  if (forwarder) targets.push(forwarder);
  return { targets };
}
```

En el `useFactory` del módulo, sustituye el bloque de transporte por:

```typescript
useFactory: (cfg: AppConfigService): any => ({
  pinoHttp: {
    level: cfg.env.LOG_LEVEL,
    ...(() => { const t = buildTransport(cfg, cfg.env.LOG_LEVEL); return t ? { transport: t } : {}; })(),
    // ... resto de opciones (redact, autoLogging, etc.)
  },
}),
```

---

### 3. Configuración fuera de NestJS (Pino puro)

Si el proyecto no usa NestJS, configura el transporte directamente al crear el logger:

```typescript
import pino from 'pino';
import path from 'path';

const transport = pino.transport({
  targets: [
    // Mantén tu destino habitual (stdout, fichero, etc.)
    { target: 'pino/file', options: { destination: 1 }, level: 'info' },
    // Añade el forwarder
    {
      target: path.join(__dirname, 'openobserve.transport'),
      options: {
        url: process.env.OO_FORWARDER_URL!,
        apiKey: process.env.OO_FORWARDER_KEY!,
        service: process.env.OO_FORWARDER_SERVICE ?? 'mi-servicio',
        env: process.env.NODE_ENV ?? 'development',
      },
      level: 'info',
    },
  ],
});

export const logger = pino({ level: 'info' }, transport);
```

---

## Campos enviados a la API

Por cada log que emite la aplicación, la API recibe este cuerpo JSON:

```json
{
  "service": "<OO_FORWARDER_SERVICE>",
  "env": "<NODE_ENV>",
  "level": "info",
  "message": "El mensaje del log",
  "time": 1700000000000,
  "request_id": "req-abc123",
  "cualquier_campo_extra": "valor"
}
```

Los campos `pid` y `hostname` se descartan. Todos los demás campos del contexto del log (campos de negocio, `trace_id`, `module`, `err`, etc.) se reenvían tal cual.

---

## Comportamiento por entorno

| Situación | Comportamiento |
|---|---|
| Vars de entorno ausentes | El transporte no se activa. La app funciona con normalidad. |
| `NODE_ENV=development` + vars presentes | Logs van a consola, a `.logs/` **y** a la API. |
| `NODE_ENV=production` + vars presentes | Logs van a stdout **y** a la API. |
| `NODE_ENV=production` + vars ausentes | Pino escribe a stdout directamente (sin transport config). |
| API caída o timeout (5 s) | El error se descarta silenciosamente. La aplicación no se ve afectada. |

---

## Consideraciones de rendimiento y seguridad

- El transporte corre en un **worker thread** separado: la latencia de red nunca bloquea el hilo principal.
- Los requests son **fire-and-forget** dentro del worker: el log siguiente se procesa sin esperar respuesta.
- Si el volumen de logs es muy alto y la API es lenta, pueden acumularse requests en vuelo. Para producción de alto tráfico considera usar un buffer/batch antes de enviar a la API.
- El `apiKey` viaja solo en el worker thread y nunca se serializa de vuelta al proceso principal.
- Asegúrate de que el valor de `OO_FORWARDER_KEY` está **redactado** en el logger del proceso principal para que no aparezca en los logs locales (`.logs/app.log`, stdout, etc.).
