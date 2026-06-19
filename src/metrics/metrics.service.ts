import { Injectable } from '@nestjs/common';
import client from 'prom-client';

/**
 * Centralise le registre Prometheus de l'application :
 *  - métriques système Node.js par défaut (CPU, mémoire, event loop, GC) ;
 *  - métriques HTTP custom (compteur + histogramme de latence par route).
 */
@Injectable()
export class MetricsService {
  private readonly registry: client.Registry;
  readonly httpRequestDuration: client.Histogram<string>;
  readonly httpRequestsTotal: client.Counter<string>;

  constructor() {
    this.registry = new client.Registry();
    this.registry.setDefaultLabels({ app: 'money-talks-api' });

    // Métriques système (process_*, nodejs_*) collectées au moment du scrape.
    client.collectDefaultMetrics({ register: this.registry });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Durée des requêtes HTTP en secondes',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.registry],
    });

    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Nombre total de requêtes HTTP traitées',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });
  }

  /** Enregistre une requête HTTP terminée (latence + incrément du compteur). */
  observeHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ) {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestDuration.observe(labels, durationSeconds);
    this.httpRequestsTotal.inc(labels);
  }

  /** Rendu texte du registre, au format d'exposition Prometheus. */
  metrics(): Promise<string> {
    return this.registry.metrics();
  }

  /** Content-Type attendu par Prometheus pour le endpoint /metrics. */
  contentType(): string {
    return this.registry.contentType;
  }
}
