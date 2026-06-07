/**
 * Snippet de referencia: logger frontend best-effort para Log Gateway API.
 * D26 — usa fetch con keepalive + Authorization, no sendBeacon.
 * US4 AC2: fallo silencioso; no propaga errores.
 * Compatible con entornos browser modernos (ES2020+).
 */

export interface FrontendLogRecord {
  service: string;
  env: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  [key: string]: unknown;
}

export interface FrontendLogClientOptions {
  /** URL base de la API, ej: https://logs.example.com */
  baseUrl: string;
  /** Bearer token: `key_id.secret` */
  apiKey: string;
  /** Tamaño máximo del lote antes de flush (def: 20) */
  batchSize?: number;
  /** Intervalo de flush en ms (def: 5000) */
  flushIntervalMs?: number;
}

export class FrontendLogClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly batchSize: number;
  private buffer: FrontendLogRecord[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: FrontendLogClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.batchSize = opts.batchSize ?? 20;

    const flushIntervalMs = opts.flushIntervalMs ?? 5000;
    this.flushTimer = setInterval(() => { this.flush(); }, flushIntervalMs);
  }

  log(record: FrontendLogRecord): void {
    this.buffer.push(record);
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    this.sendBatch(batch);
  }

  destroy(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }

  private sendBatch(batch: FrontendLogRecord[]): void {
    // keepalive permite que el request sobreviva a la navegación/cierre de pestaña
    // No se usa sendBeacon porque no soporta cabeceras personalizadas (D26)
    try {
      void fetch(`${this.baseUrl}/api/v1/logs/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(batch),
        keepalive: true,
      }).catch(() => {
        // Fallo silencioso — best-effort
      });
    } catch {
      // Fallo silencioso — best-effort
    }
  }
}

// --- Uso de ejemplo ---
// const logger = new FrontendLogClient({
//   baseUrl: 'https://logs.example.com',
//   apiKey: 'key-abc123.mysecretvalue',
// });
//
// logger.log({ service: 'frontend_app', env: 'production', level: 'info', message: 'Page loaded', path: '/home' });
//
// // Al desmontar la aplicación:
// window.addEventListener('beforeunload', () => logger.destroy());
