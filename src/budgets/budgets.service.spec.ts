import { jest } from '@jest/globals';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { BudgetsService } from './budgets.service.js';

const createPrismaMock = () => ({
  budget: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  category: {
    findUnique: jest.fn(),
  },
});

describe('BudgetsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: BudgetsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new BudgetsService(prisma as any);
  });

  describe('findAll', () => {
    it('filters by userId and orders by creation date', async () => {
      prisma.budget.findMany.mockResolvedValue([{ id: 'b1' }]);

      const result = await service.findAll('u1');

      expect(prisma.budget.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('requires a categoryId', async () => {
      await expect(service.create('u1', { amount: 10 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an unknown category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create('u1', { categoryId: 'c1', amount: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a category owned by another user', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', userId: 'other' });

      await expect(
        service.create('u1', { categoryId: 'c1', amount: 10 }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a non-integer amount', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });

      await expect(
        service.create('u1', { categoryId: 'c1', amount: 'abc' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid startDate', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });

      await expect(
        service.create('u1', {
          categoryId: 'c1',
          amount: 10,
          startDate: 'not-a-date',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a budget with a parsed and normalized payload', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      prisma.budget.create.mockResolvedValue({ id: 'b1' });

      const result = await service.create('u1', {
        categoryId: 'c1',
        amount: 100,
        period: 'monthly',
        startDate: '2026-01-01',
      });

      const createArg = prisma.budget.create.mock.calls[0][0];
      expect(createArg.data).toMatchObject({
        categoryId: 'c1',
        amount: 100,
        period: 'monthly',
        userId: 'u1',
      });
      expect(createArg.data.startDate).toBeInstanceOf(Date);
      expect(result).toEqual({ id: 'b1' });
    });
  });

  describe('delete', () => {
    it('rejects when the budget does not exist', async () => {
      prisma.budget.findUnique.mockResolvedValue(null);

      await expect(service.delete('u1', 'b1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when the budget belongs to another user', async () => {
      prisma.budget.findUnique.mockResolvedValue({ id: 'b1', userId: 'other' });

      await expect(service.delete('u1', 'b1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('deletes the budget when owned by the user', async () => {
      prisma.budget.findUnique.mockResolvedValue({ id: 'b1', userId: 'u1' });
      prisma.budget.delete.mockResolvedValue({});

      await service.delete('u1', 'b1');

      expect(prisma.budget.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
    });
  });
});
