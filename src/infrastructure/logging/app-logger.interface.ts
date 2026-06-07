export interface LogContext {
  request_id?: string;
  service?: string;
  env?: string;
  module?: string;
  operation?: string;
  trace_id?: string;
  span_id?: string;
  [key: string]: unknown;
}

export interface IAppLogger {
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | null, context?: LogContext): void;
  fatal(message: string, error?: Error | null, context?: LogContext): void;
}

export const APP_LOGGER = Symbol('APP_LOGGER');
