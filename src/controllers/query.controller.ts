import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  QueryParamsSchema,
  type QueryParams,
  type QueryResponse,
} from '../domain/schemas/query.schema';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { QueryService } from '../application/services/query.service';

const QUERY_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
      description: 'Array de eventos de log. Keys frontend reciben respuesta reducida.',
    },
    next_cursor: {
      type: 'string',
      nullable: true,
      example: 'eyJvZmZzZXQiOjEwMH0=',
      description: 'Cursor opaco para la siguiente página. null si no hay más.',
    },
    range_truncated: {
      type: 'boolean',
      example: false,
      description: 'true si el rango fue recortado (solo keys frontend, ventana máx 7d)',
    },
    limit_truncated: {
      type: 'boolean',
      example: false,
      description: 'true si el limit fue recortado (solo keys frontend, máx 500)',
    },
    total: {
      type: 'integer',
      description: 'Solo presente con include_total=true y keys backend. Operación costosa.',
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
        code: { type: 'string', example: 'forbidden' },
        message: { type: 'string', example: 'Descripción del error' },
      },
    },
    request_id: { type: 'string', example: 'b7e2c9a1-4f3d-4b8e-a1c2-d3e4f5a6b7c8' },
  },
} as const;

@ApiTags('Consulta')
@ApiBearerAuth('apiKey')
@Controller('logs')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar logs por servicio con filtros seguros',
    description:
      'Exige el parámetro `service`. El SQL se construye por allowlist y escape ' +
      '(no hay riesgo de inyección). Las keys frontend reciben respuesta reducida, ' +
      'no pueden usar `q`, tienen ventana máxima de 7 días y límite de 500 (FR-015..FR-018).',
  })
  @ApiQuery({ name: 'service', required: true, example: 'payments_api', description: 'Identificador del servicio a consultar (^[a-z0-9_]{3,64}$)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01T00:00:00Z', description: 'Inicio del rango (ISO-8601). Default: now-1h' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-01T23:59:59Z', description: 'Fin del rango (ISO-8601). Default: now' })
  @ApiQuery({ name: 'level', required: false, example: 'error,warn', description: 'Uno o varios niveles separados por coma' })
  @ApiQuery({ name: 'env', required: false, example: 'production', description: 'Filtrar por entorno' })
  @ApiQuery({ name: 'q', required: false, example: 'timeout', description: 'Búsqueda de texto libre en message. PROHIBIDO para keys frontend.' })
  @ApiQuery({ name: 'trace_id', required: false, example: 'abc-123', description: 'Filtrar por trace_id exacto' })
  @ApiQuery({ name: 'request_id', required: false, example: 'req-456', description: 'Filtrar por request_id exacto' })
  @ApiQuery({ name: 'limit', required: false, example: 100, description: 'Número de resultados (máx 1000 backend, máx 500 frontend). Default: 100' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Cursor opaco de una respuesta anterior para paginar' })
  @ApiQuery({ name: 'sort', required: false, enum: ['asc', 'desc'], example: 'desc', description: 'Orden temporal. Default: desc' })
  @ApiQuery({ name: 'include_total', required: false, type: Boolean, description: 'Incluir total de resultados. Solo keys backend; operación costosa.' })
  @ApiResponse({ status: 200, description: 'Resultados de consulta con cursor de paginación', schema: QUERY_RESULT_SCHEMA })
  @ApiResponse({ status: 400, description: 'Parámetro service ausente u otro error de validación', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 401, description: 'API key ausente, inválida o secreto incorrecto', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 403, description: 'Sin scope read, service no autorizado o restricción frontend (q / service / env)', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 429, description: 'Rate limit superado', schema: ERROR_SCHEMA })
  @ApiResponse({ status: 502, description: 'OpenObserve falló en la consulta síncrona', schema: ERROR_SCHEMA })
  async query(
    @Query(new ZodValidationPipe(QueryParamsSchema)) params: QueryParams,
    @Req() req: Request,
  ): Promise<QueryResponse> {
    return this.queryService.query(params, req.apiKey!, req.requestId ?? '');
  }
}
