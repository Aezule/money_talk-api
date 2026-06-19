// Test d'INTÉGRATION HTTP : module Metrics réel + un controller de test,
// requêtes via supertest. Vérifie l'exposition /metrics et l'instrumentation
// automatique des routes par l'intercepteur global.
import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { MetricsModule } from './metrics.module.js';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { pong: true };
  }
}

describe('Metrics (integration)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MetricsModule],
      controllers: [PingController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /metrics renvoie les métriques au format Prometheus', async () => {
    const res = await request(app.getHttpServer()).get('/metrics').expect(200);

    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('process_cpu_user_seconds_total');
    expect(res.text).toContain('http_requests_total');
  });

  it('instrumente automatiquement les routes traversées', async () => {
    await request(app.getHttpServer()).get('/ping').expect(200);
    // Laisse l'événement `finish` de la réponse se déclencher.
    await new Promise((resolve) => setImmediate(resolve));

    const res = await request(app.getHttpServer()).get('/metrics').expect(200);

    expect(res.text).toContain('route="/ping"');
    expect(res.text).toMatch(/http_requests_total\{[^}]*route="\/ping"[^}]*\} 1/);
  });
});
