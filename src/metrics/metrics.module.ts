import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { HttpMetricsInterceptor } from './http-metrics.interceptor.js';

/**
 * Module de supervision : expose `/metrics` et enregistre l'intercepteur HTTP
 * globalement (APP_INTERCEPTOR) pour instrumenter toutes les routes.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
