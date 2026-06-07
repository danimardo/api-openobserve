import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { MetricsService } from '../infrastructure/metrics/metrics.service';

@ApiTags('Operación')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Métricas Prometheus',
    description:
      'Expone métricas del gateway en formato Prometheus (text/plain). ' +
      'No requiere API key. Configura Prometheus con metrics_path: /api/v1/metrics (FR-029).',
  })
  @ApiProduces('text/plain')
  @ApiResponse({
    status: 200,
    description: 'Métricas en formato Prometheus exposition format',
    schema: {
      type: 'string',
      example:
        '# HELP log_gateway_ingest_accepted_total Eventos aceptados en cola\n' +
        '# TYPE log_gateway_ingest_accepted_total counter\n' +
        'log_gateway_ingest_accepted_total 42\n',
    },
  })
  async metrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
