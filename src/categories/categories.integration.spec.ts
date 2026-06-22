// Test d'INTÉGRATION HTTP
import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
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
  categories: any[] = [];
  transactions: any[] = [];
  budgets: any[] = [];
  private seq = 0;

  category = {
    findMany: async ({ where }: any) =>
      this.categories.filter(
        (c) =>
          (!where?.userId || c.userId === where.userId) &&
          (where?.type === undefined || (c.type ?? 'expense') === where.type),
      ),
    findUnique: async ({ where }: any) =>
      this.categories.find((c) => c.id === where.id) ?? null,
    create: async ({ data }: any) => {
      const row = { id: `c-${++this.seq}`, ...data };
      this.categories.push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = this.categories.find((c) => c.id === where.id);
      Object.assign(row, data);
      return row;
    },
    delete: async ({ where }: any) => {
      const idx = this.categories.findIndex((c) => c.id === where.id);
      return this.categories.splice(idx, 1)[0];
    },
  };

  transaction = {
    updateMany: async ({ where, data }: any) => {
      this.transactions
        .filter(
          (t) => t.userId === where.userId && t.categoryId === where.categoryId,
        )
        .forEach((t) => Object.assign(t, data));
    },
  };

  budget = {
    deleteMany: async ({ where }: any) => {
      this.budgets = this.budgets.filter(
        (b) =>
          !(b.userId === where.userId && b.categoryId === where.categoryId),
      );
    },
  };

  $transaction = async (cb: any) => cb();
}

describe('Categories (integration)', () => {
  let app: INestApplication;
  let prisma: InMemoryPrisma;

  beforeEach(async () => {
    prisma = new InMemoryPrisma();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /categories creates a category for the authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .post('/categories')
      .send({ name: '  Food  ', type: 'expense' })
      .expect(201);

    expect(res.body.message).toBe('Category created successfully');
    expect(res.body.newCategory).toMatchObject({
      name: 'Food',
      type: 'expense',
      userId: TEST_USER,
    });
    expect(prisma.categories).toHaveLength(1);
  });

  it('POST /categories rejects a missing name via ValidationPipe (400)', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .send({ type: 'expense' })
      .expect(400);
  });

  it('POST /categories rejects a duplicate name (409)', async () => {
    prisma.categories.push({
      id: 'c-seed',
      name: 'Food',
      type: 'expense',
      userId: TEST_USER,
    });

    await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'food', type: 'expense' })
      .expect(409);
  });

  it('GET /categories returns only the authenticated user categories', async () => {
    prisma.categories.push({ id: 'c-own', name: 'A', userId: TEST_USER });
    prisma.categories.push({ id: 'c-foreign', name: 'B', userId: OTHER_USER });

    const res = await request(app.getHttpServer())
      .get('/categories')
      .expect(200);

    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].id).toBe('c-own');
  });

  it('PUT /categories/:id updates an owned category', async () => {
    prisma.categories.push({
      id: 'c-up',
      name: 'Old',
      type: 'expense',
      userId: TEST_USER,
    });

    const res = await request(app.getHttpServer())
      .put('/categories/c-up')
      .send({ name: 'New' })
      .expect(200);

    expect(res.body.category.name).toBe('New');
  });

  it('PUT /categories/:id returns 401 for a category owned by another user', async () => {
    prisma.categories.push({
      id: 'c-foreign',
      name: 'Old',
      type: 'expense',
      userId: OTHER_USER,
    });

    await request(app.getHttpServer())
      .put('/categories/c-foreign')
      .send({ name: 'New' })
      .expect(401);
  });

  it('DELETE /categories/:id cascades and removes an owned category', async () => {
    prisma.categories.push({
      id: 'c-del',
      name: 'Gone',
      userId: TEST_USER,
    });
    prisma.budgets.push({ id: 'b1', userId: TEST_USER, categoryId: 'c-del' });
    prisma.transactions.push({
      id: 't1',
      userId: TEST_USER,
      categoryId: 'c-del',
    });

    await request(app.getHttpServer()).delete('/categories/c-del').expect(200);

    expect(prisma.categories).toHaveLength(0);
    expect(prisma.budgets).toHaveLength(0);
    expect(prisma.transactions[0].categoryId).toBeNull();
  });

  it('DELETE /categories/:id returns 404 when the category is missing', async () => {
    await request(app.getHttpServer())
      .delete('/categories/does-not-exist')
      .expect(404);
  });
});
