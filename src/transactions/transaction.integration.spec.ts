// Test d'INTÉGRATION HTTP
import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TransactionController } from './transaction.controller.js';
import { TransactionService } from './transaction.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TEST_USER = 'user-1';
const OTHER_USER = 'user-2';

/**
 * Substitut en mémoire de PrismaService : permet d'exercer toute la chaîne HTTP
 * (routage -> ValidationPipe -> guard -> controller -> service -> persistance)
 * sans avoir besoin d'une vraie instance MongoDB.
 */
class InMemoryPrisma {
  transactions: any[] = [];
  categories: any[] = [];
  private seq = 0;

  transaction = {
    findMany: async ({ where }: any) =>
      this.transactions.filter(
        (t) =>
          (!where?.userId || t.userId === where.userId) &&
          (where?.isRecurring === undefined ||
            t.isRecurring === where.isRecurring),
      ),
    findUnique: async ({ where }: any) =>
      this.transactions.find((t) => t.id === where.id) ?? null,
    create: async ({ data }: any) => {
      const row = { id: `t-${++this.seq}`, createdAt: new Date(), ...data };
      this.transactions.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = this.transactions.find((t) => t.id === where.id);
      Object.assign(row, data);
      return row;
    },
    delete: async ({ where }: any) => {
      const idx = this.transactions.findIndex((t) => t.id === where.id);
      return this.transactions.splice(idx, 1)[0];
    },
  };

  category = {
    findUnique: async ({ where }: any) =>
      this.categories.find((c) => c.id === where.id) ?? null,
  };
}

describe('Transactions (integration)', () => {
  let app: INestApplication;
  let prisma: InMemoryPrisma;

  beforeEach(async () => {
    prisma = new InMemoryPrisma();
    prisma.categories.push({ id: 'cat-own', userId: TEST_USER });
    prisma.categories.push({ id: 'cat-other', userId: OTHER_USER });

    const notifications = {
      checkBudgetForCategory: jest.fn<any>().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        TransactionService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notifications },
      ],
    })
      // Remplace le vrai JwtAuthGuard par un guard qui injecte un utilisateur authentifié.
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = {
            sub: TEST_USER,
            id: TEST_USER,
          };
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

  it('POST /transactions creates a transaction for the authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .post('/transactions')
      .send({
        categoryId: 'cat-own',
        amount: 1200,
        type: 'expense',
        date: '2022-09-27T18:00:00.000Z',
      })
      .expect(201);

    expect(res.body.message).toBe('Transaction created successfully');
    expect(res.body.newTransaction).toMatchObject({
      categoryId: 'cat-own',
      amount: 1200,
      userId: TEST_USER,
    });
    expect(prisma.transactions).toHaveLength(1);
  });

  it('POST /transactions drops a category owned by another user', async () => {
    const res = await request(app.getHttpServer())
      .post('/transactions')
      .send({
        categoryId: 'cat-other',
        amount: 50,
        type: 'expense',
        date: '2022-09-27T18:00:00.000Z',
      })
      .expect(201);

    expect(res.body.newTransaction.categoryId).toBeUndefined();
    expect(prisma.transactions[0]).not.toHaveProperty('categoryId');
  });

  it('POST /transactions rejects an invalid body via ValidationPipe (400)', async () => {
    await request(app.getHttpServer())
      .post('/transactions')
      .send({ amount: 'not-a-number', type: 'expense', date: 'nope' })
      .expect(400);
  });

  it('GET /transactions returns only the authenticated user transactions', async () => {
    prisma.transactions.push({ id: 't-seed', userId: TEST_USER, amount: 5 });
    prisma.transactions.push({ id: 't-foreign', userId: OTHER_USER, amount: 9 });

    const res = await request(app.getHttpServer())
      .get('/transactions')
      .expect(200);

    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].id).toBe('t-seed');
  });

  it('GET /transactions/recurring deduplicates recurring transactions', async () => {
    prisma.transactions.push(
      {
        id: 'r1',
        userId: TEST_USER,
        isRecurring: true,
        type: 'expense',
        categoryId: 'cat-own',
        amount: 10,
        description: 'rent',
      },
      {
        id: 'r2',
        userId: TEST_USER,
        isRecurring: true,
        type: 'expense',
        categoryId: 'cat-own',
        amount: 10,
        description: 'rent',
      },
      {
        id: 'r3',
        userId: TEST_USER,
        isRecurring: true,
        type: 'expense',
        categoryId: 'cat-own',
        amount: 5,
        description: 'gym',
      },
    );

    const res = await request(app.getHttpServer())
      .get('/transactions/recurring')
      .expect(200);

    expect(res.body.transactions).toHaveLength(2);
  });

  it('PUT /transactions/:id updates an owned transaction', async () => {
    prisma.transactions.push({ id: 't-up', userId: TEST_USER, amount: 10 });

    const res = await request(app.getHttpServer())
      .put('/transactions/t-up')
      .send({ amount: 99 })
      .expect(200);

    expect(res.body.transaction.amount).toBe(99);
  });

  it('PUT /transactions/:id returns 404 for a transaction owned by another user', async () => {
    prisma.transactions.push({ id: 't-foreign', userId: OTHER_USER, amount: 10 });

    await request(app.getHttpServer())
      .put('/transactions/t-foreign')
      .send({ amount: 99 })
      .expect(404);
  });

  it('DELETE /transactions/:id removes an owned transaction', async () => {
    prisma.transactions.push({ id: 't-del', userId: TEST_USER, amount: 10 });

    await request(app.getHttpServer())
      .delete('/transactions/t-del')
      .expect(200);

    expect(prisma.transactions).toHaveLength(0);
  });
});
