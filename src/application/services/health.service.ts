import { Inject, Injectable } from '@nestjs/common';
import axios from 'axios';
import { AppConfigService } from '../../infrastructure/config/app-config.service';
import { APP_LOGGER, type IAppLogger } from '../../infrastructure/logging/app-logger.interface';

export interface HealthStatus {
  status: 'ok' | 'error';
  openobserve?: 'reachable' | 'unreachable';
}

@Injectable()
export class HealthService {
  constructor(
    private readonly config: AppConfigService,
    @Inject(APP_LOGGER) private readonly logger: IAppLogger,
  ) {}

  liveness(): HealthStatus {
    return { status: 'ok' };
  }

  async readiness(): Promise<HealthStatus> {
    try {
      // GET {O2_URL}/healthz — endpoint estándar de OpenObserve que no requiere permisos
      // de administrador. validateStatus < 500 considera cualquier respuesta HTTP como
      // "alcanzable"; solo errores de red (timeout, ECONNREFUSED) son "inalcanzable".
      await axios.get(`${this.config.env.O2_URL}/healthz`, {
        timeout: 5_000,
        validateStatus: (s) => s < 500,
      });
      return { status: 'ok', openobserve: 'reachable' };
    } catch (err) {
      const error = err as Error & { response?: { status?: number } };
      this.logger.warn('OpenObserve readiness check failed', {
        module: 'HealthService',
        operation: 'readiness',
        httpStatus: error.response?.status,
        errorMessage: error.message,
      });
      return { status: 'error', openobserve: 'unreachable' };
    }
  }
}
