import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { BudgetsController } from './budgets.controller.js';
import { BudgetsService } from './budgets.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TEST_USER = 'user-1';
const OTHER_USER = 'user-2';

/**
 * Minimal in-memory stand-in for PrismaService so the whole HTTP pipeline
 * (routing -> ValidationPipe -> guard -> controller -> service -> persistence)
 * can be exercised without a real MongoDB instance.
 */
class InMemoryPrisma {
  budgets: any[] = [];
  categories: any[] = [];
  private seq = 0;

  budget = {
    findMany: async ({ where }: any) =>
      this.budgets.filter((b) => !where?.userId || b.userId === where.userId),
    findUnique: async ({ where }: any) =>
      this.budgets.find((b) => b.id === where.id) ?? null,
    create: async ({ data }: any) => {
      const row = { id: `b-${++this.seq}`, createdAt: new Date(), ...data };
      this.budgets.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = this.budgets.find((b) => b.id === where.id);
      Object.assign(row, data);
      return row;
    },
    delete: async ({ where }: any) => {
      const idx = this.budgets.findIndex((b) => b.id === where.id);
      return this.budgets.splice(idx, 1)[0];
    },
  };

  category = {
    findUnique: async ({ where }: any) =>
      this.categories.find((c) => c.id === where.id) ?? null,
  };
}

describe('Budgets (integration)', () => {
  let app: INestApplication;
  let prisma: InMemoryPrisma;

  beforeEach(async () => {
    prisma = new InMemoryPrisma();
    prisma.categories.push({ id: 'cat-own', userId: TEST_USER });
    prisma.categories.push({ id: 'cat-other', userId: OTHER_USER });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BudgetsController],
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    })
      // Replace the real JWT guard with one that injects an authenticated user.
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { sub: TEST_USER, id: TEST_USER };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /budgets creates a budget for the authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .post('/budgets')
      .send({ categoryId: 'cat-own', amount: 120000, period: 'monthly' })
      .expect(201);

    expect(res.body.message).toBe('Budget created successfully');
    expect(res.body.newBudget).toMatchObject({
      categoryId: 'cat-own',
      amount: 120000,
      userId: TEST_USER,
    });
    expect(prisma.budgets).toHaveLength(1);
  });

  it('GET /budgets returns only the authenticated user budgets', async () => {
    prisma.budgets.push({ id: 'b-seed', userId: TEST_USER, amount: 50 });
    prisma.budgets.push({ id: 'b-foreign', userId: OTHER_USER, amount: 99 });

    const res = await request(app.getHttpServer()).get('/budgets').expect(200);

    expect(res.body.budgets).toHaveLength(1);
    expect(res.body.budgets[0].id).toBe('b-seed');
  });

  it('POST /budgets rejects a category owned by another user (401)', async () => {
    await request(app.getHttpServer())
      .post('/budgets')
      .send({ categoryId: 'cat-other', amount: 120000, period: 'monthly' })
      .expect(401);

    expect(prisma.budgets).toHaveLength(0);
  });

  it('POST /budgets rejects an invalid body via ValidationPipe (400)', async () => {
    await request(app.getHttpServer())
      .post('/budgets')
      .send({ amount: 'not-a-number' })
      .expect(400);
  });

  it('DELETE /budgets/:id removes the budget', async () => {
    prisma.budgets.push({ id: 'b-del', userId: TEST_USER, amount: 10 });

    await request(app.getHttpServer()).delete('/budgets/b-del').expect(200);

    expect(prisma.budgets).toHaveLength(0);
  });
});
