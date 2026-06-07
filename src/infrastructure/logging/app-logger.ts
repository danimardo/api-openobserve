import { Injectable, Inject } from '@nestjs/common';
import type { Logger as PinoInstance } from 'pino';
import { type IAppLogger, type LogContext, APP_LOGGER } from './app-logger.interface';
import { redactLogData } from './redact';

export const PINO_INSTANCE = Symbol('PINO_INSTANCE');

@Injectable()
export class AppLogger implements IAppLogger {
  constructor(@Inject(PINO_INSTANCE) private readonly pino: PinoInstance) {}

  private buildFields(context?: LogContext): Record<string, unknown> {
    if (!context) return {};
    return redactLogData(context as Record<string, unknown>);
  }

  trace(message: string, context?: LogContext): void {
    this.pino.trace(this.buildFields(context), message);
  }

  debug(message: string, context?: LogContext): void {
    this.pino.debug(this.buildFields(context), message);
  }

  info(message: string, context?: LogContext): void {
    this.pino.info(this.buildFields(context), message);
  }

  warn(message: string, context?: LogContext): void {
    this.pino.warn(this.buildFields(context), message);
  }

  error(message: string, error?: Error | null, context?: LogContext): void {
    const fields: Record<string, unknown> = { ...this.buildFields(context) };
    if (error) {
      fields['err'] = { type: error.name, message: error.message, stack: error.stack };
    }
    this.pino.error(fields, message);
  }

  fatal(message: string, error?: Error | null, context?: LogContext): void {
    const fields: Record<string, unknown> = { ...this.buildFields(context) };
    if (error) {
      fields['err'] = { type: error.name, message: error.message, stack: error.stack };
    }
    this.pino.fatal(fields, message);
  }
}

export { APP_LOGGER };
