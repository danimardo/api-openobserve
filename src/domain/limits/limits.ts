// FR-031: reglas de límites puras (sin dependencias de framework)

export interface LimitsConfig {
  LOG_MESSAGE_MAX_CHARS: number;
  MAX_FIELDS_PER_RECORD: number;
  CONTEXT_VALUE_MAX_CHARS: number;
  INGEST_MAX_BATCH: number;
  INGEST_MAX_BODY_MB: number;
}

export function exceedsMessageLimit(message: string, maxChars: number): boolean {
  return message.length > maxChars;
}

export function exceedsBatchLimit(count: number, maxBatch: number): boolean {
  return count > maxBatch;
}

export function exceedsBodyLimit(bytes: number, maxMb: number): boolean {
  return bytes > maxMb * 1024 * 1024;
}

export function exceedsFieldLimit(fieldCount: number, maxFields: number): boolean {
  return fieldCount > maxFields;
}

export function exceedsValueLimit(value: string, maxChars: number): boolean {
  return value.length > maxChars;
}
