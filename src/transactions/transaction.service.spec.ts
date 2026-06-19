import { jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionService } from './transaction.service.js';

const createPrismaMock = () => ({
  transaction: {
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

describe('TransactionService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let notifications: { checkBudgetForCategory: jest.Mock };
  let service: TransactionService;

  beforeEach(() => {
    prisma = createPrismaMock();
    notifications = {
      checkBudgetForCategory: jest.fn().mockResolvedValue(undefined),
    };
    service = new TransactionService(prisma as any, notifications as any);
  });

  describe('findAll', () => {
    it('returns an empty list when the collection is missing (P2021)', async () => {
      prisma.transaction.findMany.mockRejectedValue({ code: 'P2021' });

      await expect(service.findAll('u1')).resolves.toEqual([]);
    });

    it('rethrows unexpected errors', async () => {
      prisma.transaction.findMany.mockRejectedValue(new Error('boom'));

      await expect(service.findAll('u1')).rejects.toThrow('boom');
    });
  });

  describe('createTransaction', () => {
    it('rejects an invalid date', async () => {
      await expect(
        service.createTransaction('u1', { amount: 10, date: 'nope' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('drops a categoryId that belongs to another user', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', userId: 'other' });
      prisma.transaction.create.mockResolvedValue({ id: 't1' });

      await service.createTransaction('u1', { amount: 10, categoryId: 'c1' });

      const createArg = prisma.transaction.create.mock.calls[0][0];
      expect(createArg.data).not.toHaveProperty('categoryId');
    });

    it('keeps an owned categoryId and triggers the budget check', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      prisma.transaction.create.mockResolvedValue({ id: 't1', categoryId: 'c1' });

      await service.createTransaction('u1', { amount: 10, categoryId: 'c1' });

      expect(notifications.checkBudgetForCategory).toHaveBeenCalledWith(
        'u1',
        'c1',
      );
    });
  });

  describe('deleteTransaction', () => {
    it('throws NotFoundException when missing or not owned', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'other',
      });

      await expect(
        service.deleteTransaction('u1', 't1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes the transaction when owned', async () => {
      prisma.transaction.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
      prisma.transaction.delete.mockResolvedValue({ id: 't1' });

      await service.deleteTransaction('u1', 't1');

      expect(prisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: 't1' },
      });
    });
  });

  describe('findRecurring', () => {
    it('deduplicates recurring transactions by signature', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { id: '1', type: 'expense', categoryId: 'c1', amount: 10, description: 'rent' },
        { id: '2', type: 'expense', categoryId: 'c1', amount: 10, description: 'rent' },
        { id: '3', type: 'expense', categoryId: 'c2', amount: 5, description: 'gym' },
      ]);

      const result = await service.findRecurring('u1');

      expect(result).toHaveLength(2);
    });
  });
});
