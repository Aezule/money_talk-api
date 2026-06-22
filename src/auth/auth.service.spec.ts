// Test UNITAIRE
import { jest } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';

const createPrismaMock = () => ({
  utilisateur: {
    findUnique: jest.fn<any>(),
    findFirst: jest.fn<any>(),
    create: jest.fn<any>(),
    update: jest.fn<any>(),
  },
  refreshToken: {
    findUnique: jest.fn<any>(),
    create: jest.fn<any>(),
    update: jest.fn<any>(),
  },
});

describe('AuthService', () => {
  let prisma: any;
  let jwt: { sign: jest.Mock; verify: jest.Mock };
  let email: any;
  let config: { get: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    jwt = {
      sign: jest.fn<any>().mockReturnValue('signed.jwt.token'),
      verify: jest.fn<any>(),
    };
    email = { sendResetPasswordLink: jest.fn<any>() };
    config = { get: jest.fn<any>().mockReturnValue('secret') };
    service = new AuthService(prisma, jwt as any, email, config as any);
  });

  describe('createUser', () => {
    it('throws ConflictException when the email is already registered', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
      });

      await expect(
        service.createUser('a@a.com', 'pw', 'A', 'B'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.utilisateur.create).not.toHaveBeenCalled();
    });

    it('hashes the password and returns a public user with an access token', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);
      prisma.utilisateur.create.mockImplementation(async ({ data }: any) => ({
        id: data.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
      }));

      const result = await service.createUser('new@a.com', 'pw', 'A', 'B');

      const createArg = prisma.utilisateur.create.mock.calls[0][0];
      expect(createArg.data.password).not.toBe('pw');
      expect(await bcrypt.compare('pw', createArg.data.password)).toBe(true);
      expect(result).toMatchObject({
        email: 'new@a.com',
        accessToken: 'signed.jwt.token',
      });
    });
  });

  describe('loginUser', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      prisma.utilisateur.findUnique.mockResolvedValue(null);

      await expect(service.loginUser('x@x.com', 'pw')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      const password = await bcrypt.hash('correct', 10);
      prisma.utilisateur.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        firstName: null,
        lastName: null,
        password,
      });

      await expect(
        service.loginUser('a@a.com', 'wrong'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns a public user without the password hash on success', async () => {
      const password = await bcrypt.hash('correct', 10);
      prisma.utilisateur.findUnique.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        firstName: 'A',
        lastName: 'B',
        password,
      });

      const result = await service.loginUser('a@a.com', 'correct');

      expect(result).not.toHaveProperty('password');
      expect(result.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('refresh tokens', () => {
    it('revokeRefreshToken is a no-op for an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await service.revokeRefreshToken('raw');

      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it('verifyAndRotateRefreshToken rejects a revoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        revoked: true,
        expiresAt: new Date(Date.now() + 10_000),
      });

      await expect(
        service.verifyAndRotateRefreshToken('raw'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('verifyAndRotateRefreshToken rotates the token and returns the user', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 't1',
        userId: 'u1',
        revoked: false,
        expiresAt: new Date(Date.now() + 100_000),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.utilisateur.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@a.com',
        firstName: null,
        lastName: null,
      });

      const { user, refreshRaw } =
        await service.verifyAndRotateRefreshToken('raw');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { revoked: true },
      });
      expect(user.id).toBe('u1');
      expect(typeof refreshRaw).toBe('string');
      expect(refreshRaw.length).toBeGreaterThan(0);
    });
  });

  describe('forgetPassword', () => {
    it('delegates to the email service', async () => {
      email.sendResetPasswordLink.mockResolvedValue(undefined);

      await service.forgetPassword('a@a.com');

      expect(email.sendResetPasswordLink).toHaveBeenCalledWith('a@a.com');
    });
  });
});
