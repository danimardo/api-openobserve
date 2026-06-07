import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from '../application/services/health.service';

@ApiTags('Operación')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: 'Liveness — el proceso HTTP está vivo',
    description:
      'Responde 200 siempre que el proceso esté activo. NO comprueba OpenObserve. ' +
      'Úsalo como liveness probe en Kubernetes / Coolify. No requiere API key (FR-028).',
  })
  @ApiResponse({ status: 200, description: 'Proceso activo', schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } })
  liveness(): { status: string } {
    return this.healthService.liveness();
  }

  @Get('ready')
  @Public()
  @ApiOperation({
    summary: 'Readiness — conectividad con OpenObserve',
    description:
      'Responde 200 si puede conectar con OpenObserve y la configuración es válida. ' +
      'Responde 503 si no. Úsalo como readiness probe. No requiere API key (FR-028).',
  })
  @ApiResponse({ status: 200, description: 'Listo — OpenObserve accesible', schema: { type: 'object', properties: { status: { type: 'string', example: 'ready' } } } })
  @ApiResponse({ status: 503, description: 'No listo — OpenObserve inaccesible o config inválida', schema: { type: 'object', properties: { status: { type: 'string', example: 'not_ready' } } } })
  async readiness(@Res() res: Response): Promise<void> {
    const result = await this.healthService.readiness();
    const statusCode = result.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(result);
  }
}
