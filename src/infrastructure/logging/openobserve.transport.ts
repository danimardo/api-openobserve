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
        ...rest,
      });

      // Fire-and-forget: el worker no bloquea al procesar el siguiente log
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
