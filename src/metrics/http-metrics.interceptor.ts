import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { MetricsService } from './metrics.service.js';

/**
 * Mesure chaque requête HTTP traitée par un controller : on s'abonne à
 * l'événement `finish` de la réponse pour récupérer le code de statut FINAL
 * (après l'exception filter) ainsi que la latence réelle.
 *
 * Note : enregistré comme APP_INTERCEPTOR, il s'exécute après les guards ; les
 * requêtes rejetées en amont (ex. 401 par un guard) ne sont donc pas comptées.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = process.hrtime.bigint();

    res.once('finish', () => {
      const route = (req.route?.path as string) ?? 'unknown';
      // On n'instrumente pas le endpoint de scrape lui-même.
      if (route === '/metrics') return;

      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.observeHttpRequest(
        req.method,
        route,
        res.statusCode,
        durationSeconds,
      );
    });

    return next.handle();
  }
}
