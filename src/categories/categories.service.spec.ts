import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service.js';

const createPrismaMock = () => ({
  category: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  transaction: {
    updateMany: jest.fn(),
  },
  budget: {
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((cb: any) => cb()),
});

describe('CategoriesService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: CategoriesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new CategoriesService(prisma as any);
  });

  describe('create', () => {
    it('requires a non-empty name', async () => {
      await expect(service.create('u1', { name: '   ' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a duplicate name (case-insensitive)', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'c1', name: 'Food' }]);

      await expect(
        service.create('u1', { name: ' food ' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a parent category owned by another user', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'p1', userId: 'other' });

      await expect(
        service.create('u1', { name: 'Sub', parentCategoryId: 'p1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('creates a category with a trimmed name and default type', async () => {
      prisma.category.findMany.mockResolvedValue([]);
      prisma.category.create.mockResolvedValue({ id: 'c2', name: 'Food' });

      const result = await service.create('u1', { name: '  Food  ' });

      const createArg = prisma.category.create.mock.calls[0][0];
      expect(createArg.data).toMatchObject({
        name: 'Food',
        type: 'expense',
        userId: 'u1',
      });
      expect(result).toEqual({ id: 'c2', name: 'Food' });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('u1', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('cascades deletions in a transaction when owned', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });

      await service.remove('u1', 'c1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.budget.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', categoryId: 'c1' },
      });
      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { userId: 'u1', categoryId: 'c1' },
        data: { categoryId: null },
      });
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'c1' },
      });
    });
  });
});
