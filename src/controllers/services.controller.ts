import { Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ListServicesService } from '../application/services/list-services.service';

const SERVICES_INFO_SCHEMA = {
  type: 'object',
  properties: {
    services: {
      type: 'array',
      items: { type: 'string' },
      example: ['payments_api', 'auth_service'],
    },
    envs: { type: 'array', items: { type: 'string' }, example: ['production', 'staging'] },
    scopes: {
      type: 'array',
      items: { type: 'string', enum: ['read', 'write'] },
      example: ['write', 'read'],
    },
    client_type: { type: 'string', enum: ['backend', 'frontend'], example: 'backend' },
    allowed_origins: { type: 'array', items: { type: 'string' }, example: [] },
    read_policy: {
      type: 'object',
      properties: {
        max_query_window: { type: 'string', example: '7d' },
        max_limit: { type: 'integer', example: 1000 },
        allow_q: { type: 'boolean', example: true, description: 'false para keys frontend' },
        response_profile: { type: 'string', enum: ['full', 'frontend_reduced'], example: 'full' },
      },
    },
  },
} as const;

@ApiTags('Descubrimiento')
@ApiBearerAuth('apiKey')
@Controller('services')
export class ServicesController {
  constructor(private readonly listServicesService: ListServicesService) {}

  @Get()
  @ApiOperation({
    summary: 'Capacidades de la API key actual',
    description:
      'Devuelve services, scopes, client_type y allowed_origins; envs y read_policy cuando estén configurados. ' +
      'Nunca expone hashes, secretos ni datos de otras keys. ' +
      'Útil para que tu aplicación se autoconfigure (FR-027, US8).',
  })
  @ApiResponse({
    status: 200,
    description: 'Capacidades de la key autenticada',
    schema: SERVICES_INFO_SCHEMA,
  })
  @ApiResponse({
    status: 401,
    description: 'API key ausente, inválida o secreto incorrecto',
    schema: {
      type: 'object',
      properties: {
        error: {
          type: 'object',
          properties: {
            code: { type: 'string', example: 'unauthorized' },
            message: { type: 'string' },
          },
        },
        request_id: { type: 'string' },
      },
    },
  })
  getServices(@Req() req: Request) {
    return this.listServicesService.getCapabilities(req.apiKey!);
  }
}
