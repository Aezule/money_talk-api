import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MetricsService } from './metrics.service.js';

@ApiTags('Monitoring')
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Expose les métriques au format Prometheus' })
  @ApiResponse({ status: 200, description: 'Métriques Prometheus (texte)' })
  async getMetrics(@Res() res: Response) {
    res.setHeader('Content-Type', this.metrics.contentType());
    res.send(await this.metrics.metrics());
  }
}
