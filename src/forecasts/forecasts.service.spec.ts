// Test UNITAIRE
import { jest } from '@jest/globals';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ForecastsService } from './forecasts.service.js';

const createPrismaMock = () => ({
  forecastLine: {
    findMany: jest.fn<any>(),
    findUnique: jest.fn<any>(),
    create: jest.fn<any>(),
    update: jest.fn<any>(),
    delete: jest.fn<any>(),
  },
  category: {
    findUnique: jest.fn<any>(),
  },
});

describe('ForecastsService', () => {
  let prisma: any;
  let service: ForecastsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new ForecastsService(prisma as any);
  });

  describe('create', () => {
    it('rejects a non-integer amount', async () => {
      await expect(
        service.create('u1', { label: 'x', amount: 12.5, type: 'expense' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a category that does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create('u1', { amount: 100, categoryId: 'c1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a category owned by another user', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', userId: 'other' });

      await expect(
        service.create('u1', { amount: 100, categoryId: 'c1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('creates a forecast line with a normalized payload', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      prisma.forecastLine.create.mockResolvedValue({ id: 'f1' });

      const result = await service.create('u1', {
        label: 'Rent',
        amount: 1200,
        type: 'expense',
        categoryId: 'c1',
      });

      const createArg = prisma.forecastLine.create.mock.calls[0][0];
      expect(createArg.data).toMatchObject({
        label: 'Rent',
        amount: 1200,
        type: 'expense',
        categoryId: 'c1',
        userId: 'u1',
      });
      expect(result).toEqual({ id: 'f1' });
    });

    it('stores a null categoryId when none is provided', async () => {
      prisma.forecastLine.create.mockResolvedValue({ id: 'f2' });

      await service.create('u1', { label: 'Misc', amount: 50, type: 'income' });

      expect(prisma.forecastLine.create.mock.calls[0][0].data.categoryId).toBeNull();
      expect(prisma.category.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws when the line does not exist', async () => {
      prisma.forecastLine.findUnique.mockResolvedValue(null);

      await expect(
        service.update('u1', 'f1', { label: 'x' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the line belongs to another user', async () => {
      prisma.forecastLine.findUnique.mockResolvedValue({ id: 'f1', userId: 'other' });

      await expect(
        service.update('u1', 'f1', { label: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('updates only the provided fields', async () => {
      prisma.forecastLine.findUnique.mockResolvedValue({ id: 'f1', userId: 'u1' });
      prisma.forecastLine.update.mockResolvedValue({ id: 'f1', label: 'New' });

      await service.update('u1', 'f1', { label: 'New' });

      const updateArg = prisma.forecastLine.update.mock.calls[0][0];
      expect(updateArg.data).toEqual({ label: 'New' });
    });
  });

  describe('delete', () => {
    it('throws when the line belongs to another user', async () => {
      prisma.forecastLine.findUnique.mockResolvedValue({ id: 'f1', userId: 'other' });

      await expect(service.delete('u1', 'f1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('deletes the line when owned', async () => {
      prisma.forecastLine.findUnique.mockResolvedValue({ id: 'f1', userId: 'u1' });
      prisma.forecastLine.delete.mockResolvedValue({ id: 'f1' });

      await service.delete('u1', 'f1');

      expect(prisma.forecastLine.delete).toHaveBeenCalledWith({
        where: { id: 'f1' },
      });
    });
  });

  describe('findAll', () => {
    it('returns the user forecast lines ordered by creation date', async () => {
      prisma.forecastLine.findMany.mockResolvedValue([{ id: 'f1' }]);

      const result = await service.findAll('u1');

      expect(prisma.forecastLine.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual([{ id: 'f1' }]);
    });
  });
});
