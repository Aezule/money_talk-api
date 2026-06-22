// Test UNITAIRE
import { jest } from '@jest/globals';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { UserService } from './user.service.js';

const createPrismaMock = () => {
  const mock: any = {
    utilisateur: {
      findUnique: jest.fn<any>(),
      update: jest.fn<any>(),
      delete: jest.fn<any>(),
    },
    transaction: {
      findMany: jest.fn<any>().mockResolvedValue([]),
      deleteMany: jest.fn<any>(),
    },
    attachment: { deleteMany: jest.fn<any>() },
    recurringTransaction: { deleteMany: jest.fn<any>() },
    budget: { deleteMany: jest.fn<any>() },
    category: { deleteMany: jest.fn<any>() },
    refreshToken: { deleteMany: jest.fn<any>() },
  };
  // $transaction exécute le callback avec le même client (comme le vrai wrapper).
  mock.$transaction = jest.fn((cb: any) => cb(mock));
  return mock;
};

describe('UserService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: UserService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UserService(prisma);
  });

  describe('find', () => {
    it('returns null when the user is missing', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);

      await expect(service.find('u1')).resolves.toBeNull();
    });

    it('strips the password from the returned user', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@a.com',
        password: 'hash',
      });

      const result = await service.find('u1');

      expect(result).not.toHaveProperty('password');
      expect(result).toMatchObject({ id: 'u1', email: 'a@a.com' });
    });
  });

  describe('modify', () => {
    it('updates the user and returns it without the password', async () => {
      prisma.utilisateur.update.mockResolvedValue({
        id: 'u1',
        email: 'b@b.com',
        password: 'hash',
      });

      const result = await service.modify('u1', { email: 'b@b.com' });

      expect(prisma.utilisateur.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { email: 'b@b.com' },
      });
      expect(result).not.toHaveProperty('password');
    });
  });

  describe('modifyPassword', () => {
    it('throws when the user is missing', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);

      await expect(
        service.modifyPassword('u1', 'old', 'new'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the current password is incorrect', async () => {
      const password = await bcrypt.hash('correct', 10);
      prisma.utilisateur.findUnique.mockResolvedValue({ id: 'u1', password });

      await expect(
        service.modifyPassword('u1', 'wrong', 'new-password'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('hashes and stores the new password on success', async () => {
      const password = await bcrypt.hash('correct', 10);
      prisma.utilisateur.findUnique.mockResolvedValue({ id: 'u1', password });
      prisma.utilisateur.update.mockResolvedValue({});

      const result = await service.modifyPassword('u1', 'correct', 'brand-new');

      const updateArg = prisma.utilisateur.update.mock.calls[0][0];
      expect(updateArg.data.password).not.toBe('brand-new');
      expect(await bcrypt.compare('brand-new', updateArg.data.password)).toBe(
        true,
      );
      expect(result).toEqual({ message: 'Password updated successfully' });
    });
  });

  describe('delete', () => {
    it('throws when the user is missing', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);

      await expect(service.delete('u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('cascades deletions inside a transaction', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.transaction.findMany.mockResolvedValue([
        { id: 't1' },
        { id: 't2' },
      ]);

      const result = await service.delete('u1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.attachment.deleteMany).toHaveBeenCalledWith({
        where: { transactionId: { in: ['t1', 't2'] } },
      });
      expect(prisma.transaction.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(prisma.budget.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(prisma.category.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(prisma.utilisateur.delete).toHaveBeenCalledWith({
        where: { id: 'u1' },
      });
      expect(result).toEqual({ message: 'User deleted successfully' });
    });

    it('skips attachment cleanup when the user has no transactions', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue({ id: 'u1' });
      prisma.transaction.findMany.mockResolvedValue([]);

      await service.delete('u1');

      expect(prisma.attachment.deleteMany).not.toHaveBeenCalled();
    });
  });
});
