/**
 * Snippet de referencia: logger backend best-effort para Log Gateway API.
 * D24 — entregable como snippet/documentación, no como SDK npm.
 * US4 AC1, AC3: buffer en memoria, flush por tamaño o intervalo, timeout, captura de errores.
 * No propaga errores a la lógica de negocio.
 */

export interface LogRecord {
  service: string;
  env: string;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  [key: string]: unknown;
}

export interface BackendLogClientOptions {
  /** URL base de la API, ej: https://logs.example.com */
  baseUrl: string;
  /** Bearer token: `key_id.secret` */
  apiKey: string;
  /** Tamaño máximo del lote antes de flush automático (def: 50) */
  batchSize?: number;
  /** Intervalo de flush en ms (def: 2000) */
  flushIntervalMs?: number;
  /** Timeout de fetch en ms (def: 3000) */
  timeoutMs?: number;
}

export class BackendLogClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly batchSize: number;
  private readonly timeoutMs: number;
  private buffer: LogRecord[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: BackendLogClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.batchSize = opts.batchSize ?? 50;
    this.timeoutMs = opts.timeoutMs ?? 3000;

    const flushIntervalMs = opts.flushIntervalMs ?? 2000;
    this.flushTimer = setInterval(() => { void this.flush(); }, flushIntervalMs);
    if (this.flushTimer.unref) this.flushTimer.unref();
  }

  log(record: LogRecord): void {
    this.buffer.push(record);
    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    await this.sendBatch(batch);
  }

  destroy(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async sendBatch(batch: LogRecord[]): Promise<void> {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await fetch(`${this.baseUrl}/api/v1/logs/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(batch),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (!res.ok) {
        // Descartamos el lote silenciosamente; no propagamos el error
      }
    } catch {
      // Error de red o timeout — descartamos silenciosamente (best-effort)
    }
  }
}

// --- Uso de ejemplo ---
// const client = new BackendLogClient({
//   baseUrl: process.env.LOG_GATEWAY_URL!,
//   apiKey: process.env.LOG_GATEWAY_KEY!,
// });
//
// client.log({ service: 'payments_api', env: 'production', level: 'info', message: 'Payment processed', amount: 9.99 });
//
// // Al apagar el proceso:
// process.on('beforeExit', async () => { await client.flush(); client.destroy(); });
