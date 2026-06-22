// Test UNITAIRE : le service est instancié directement, sans démarrer Nest.
import { MetricsService } from './metrics.service.js';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('expose les métriques système Node.js par défaut', async () => {
    const output = await service.metrics();

    expect(output).toContain('process_cpu_user_seconds_total');
    expect(output).toContain('nodejs_eventloop_lag_seconds');
    // Le label applicatif par défaut est présent.
    expect(output).toContain('app="money-talks-api"');
  });

  it("incrémente le compteur et l'histogramme HTTP", async () => {
    service.observeHttpRequest('GET', '/budgets', 200, 0.123);
    service.observeHttpRequest('GET', '/budgets', 200, 0.2);

    const output = await service.metrics();

    // L'ordre des labels n'est pas garanti -> on valide par motif.
    expect(output).toMatch(
      /http_requests_total\{[^}]*method="GET"[^}]*route="\/budgets"[^}]*status_code="200"[^}]*\} 2/,
    );
    expect(output).toContain('http_request_duration_seconds_bucket');
    expect(output).toContain('route="/budgets"');
  });

  it("renvoie le content-type d'exposition Prometheus", () => {
    expect(service.contentType()).toContain('text/plain');
  });
});
