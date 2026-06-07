import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { IngestService, type IngestResult } from '../application/services/ingest.service';

const LOG_EVENT_SCHEMA = {
  type: 'object',
  required: ['service', 'env', 'level', 'message'],
  properties: {
    _timestamp: {
      oneOf: [
        { type: 'string', example: '2026-06-01T15:32:11.000Z', description: 'ISO-8601' },
        { type: 'integer', example: 1748779931000000, description: 'Microsegundos (int64)' },
      ],
    },
    service: { type: 'string', pattern: '^[a-z0-9_]{3,64}$', example: 'payments_api' },
    env: { type: 'string', example: 'production', description: 'Dentro de ALLOWED_ENVS' },
    level: {
      type: 'string',
      example: 'info',
      description: 'trace|debug|info|warn|error|fatal (o equivalencias WARNING, ERR, CRITICAL)',
    },
    message: { type: 'string', example: 'Pago procesado correctamente' },
    version: { type: 'string', example: '1.2.3' },
    event_id: { type: 'string', example: 'evt-abc123' },
    trace_id: { type: 'string', example: 'abc-123-def' },
    span_id: { type: 'string', example: 'span-001' },
    request_id: { type: 'string', example: 'req-456' },
    hostname: { type: 'string', example: 'web-01.prod' },
    source: {
      type: 'string',
      enum: ['backend', 'frontend'],
      description: 'Valor desconocido se normaliza a "unknown"',
    },
    context: {
      type: 'object',
      additionalProperties: true,
      example: { amount: 49.99, currency: 'EUR' },
    },
  },
} as const;

const INGEST_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    accepted: { type: 'integer', example: 2 },
    rejected: { type: 'integer', example: 1 },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer', example: 1 },
          code: { type: 'string', example: 'invalid_level' },
          message: { type: 'string', example: "Level 'VERBOSE' no es válido" },
        },
      },
    },
    request_id: { type: 'string', example: 'b7e2c9a1-4f3d-4b8e-a1c2-d3e4f5a6b7c8' },
  },
} as const;

const ERROR_SCHEMA = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'validation_error' },
        message: { type: 'string', example: 'Descripción del error' },
        details: { type: 'array', items: {} },
      },
    },
    request_id: { type: 'string', example: 'b7e2c9a1-4f3d-4b8e-a1c2-d3e4f5a6b7c8' },
  },
} as const;

@ApiTags('Ingesta')
@ApiBearerAuth('apiKey')
@Controller('logs')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary: 'Ingestar uno o varios eventos de log',
    description:
      'Acepta un único LogEvent o un array. Los eventos válidos se encolan y ' +
      'entregan a OpenObserve de forma asíncrona. Responde 202 cuando al menos un ' +
      'registro es válido (FR-001, FR-007).',
  })
  @ApiBody({
    description: 'Un LogEvent o un array de LogEvents',
    schema: {
      oneOf: [LOG_EVENT_SCHEMA, { type: 'array', items: LOG_EVENT_SCHEMA }],
    },
  })
  @ApiResponse({ status: 202, description: 'Al menos un evento aceptado (aceptación parcial posible)', schema: INGEST_RESULT_SCHEMA })
  @ApiResponse({ status: 400, description: 'JSON malformado o ningún evento válido', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 401, description: 'API key ausente, inválida o secreto incorrecto', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 413, description: 'Body supera INGEST_MAX_BODY_MB', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 415, description: 'Content-Type no soportado', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 429, description: 'Rate limit superado o cola llena', schema: ERROR_SCHEMA })
  async ingest(@Body() body: unknown, @Req() req: Request): Promise<IngestResult> {
    return this.ingestService.ingest(body, req.apiKey!, req.requestId ?? '');
  }

  @Post('batch')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Ingestar un lote de eventos (array obligatorio)',
    description:
      'Exige un array. Soporta compresión gzip con la cabecera Content-Encoding: gzip. ' +
      'El límite de tamaño se aplica al body comprimido Y al JSON descomprimido (FR-002, US6).',
  })
  @ApiHeader({
    name: 'Content-Encoding',
    required: false,
    description: 'Usa "gzip" para enviar el body comprimido',
    schema: { type: 'string', enum: ['gzip'] },
  })
  @ApiBody({
    description: 'Array de LogEvents (obligatorio)',
    schema: { type: 'array', items: LOG_EVENT_SCHEMA },
  })
  @ApiResponse({ status: 202, description: 'Al menos un evento aceptado (aceptación parcial posible)', schema: INGEST_RESULT_SCHEMA })
  @ApiResponse({ status: 400, description: 'Body no es array o ningún evento válido', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 401, description: 'API key ausente, inválida o secreto incorrecto', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 413, description: 'Body supera INGEST_MAX_BODY_MB o lote supera INGEST_MAX_BATCH', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 415, description: 'Content-Type no soportado', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 429, description: 'Rate limit superado o cola llena', schema: ERROR_SCHEMA })
  async batch(@Body() body: unknown, @Req() req: Request): Promise<IngestResult> {
    return this.ingestService.ingest(body, req.apiKey!, req.requestId ?? '', true);
  }
}
