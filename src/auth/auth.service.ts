import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service.js';

import { PrismaService } from '../prisma/prisma.service.js';

export type PublicUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  accessToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  async generateRefreshToken(userId: string, days = 30): Promise<string> {
    const raw = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return raw;
  }

  async revokeRefreshToken(raw: string): Promise<void> {
    const tokenHash = this.hashToken(raw);
    const rt = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!rt) return;
    await this.prisma.refreshToken.update({
      where: { id: rt.id },
      data: { revoked: true },
    });
  }

  async verifyAndRotateRefreshToken(
    raw: string,
  ): Promise<{ user: PublicUser; refreshRaw: string }> {
    const tokenHash = this.hashToken(raw);
    const rt = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!rt || rt.revoked || rt.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: rt.id },
      data: { revoked: true },
    });

    const newRaw = await this.generateRefreshToken(rt.userId);

    const userRecord = await this.prisma.utilisateur.findUnique({
      where: { id: rt.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    if (!userRecord) throw new UnauthorizedException('User not found');

    const publicUser = this.toPublicUser(userRecord);

    return { user: publicUser, refreshRaw: newRaw };
  }

  async forgetPassword(email: string) {
    await this.emailService.sendResetPasswordLink(email);
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      this.jwtService.verify(token, {
        secret: this.configService.get('JWT_VERIFICATION_TOKEN_SECRET'),
      });
    } catch (err) {
      console.error('Token verification error:', err);
      throw new BadRequestException('Invalid or expired token');
    }

    const tokenHash = this.hashToken(token);
    const user: any = await this.prisma.utilisateur.findFirst({
      where: ({ resetTokenHash: tokenHash } as any),
      select: ({ id: true, resetTokenExpiresAt: true } as any),
    });

    if (!user?.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.utilisateur.update({
      where: { id: user.id },
      data: { password: passwordHash, resetTokenHash: null, resetTokenExpiresAt: null } as any,
    });
  }

  async createUser(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<PublicUser> {
    const existingUser = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const userId = uuid();
    const passwordHash = await bcrypt.hash(password, 10);

    const createdUser = await this.prisma.utilisateur.create({
      data: {
        id: userId,
        userId,
        email,
        password: passwordHash,
        firstName: firstName || null,
        lastName: lastName || null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    return this.toPublicUser(createdUser);
  }

  async loginUser(email: string, password: string): Promise<PublicUser> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        password: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password: _password, ...safeUser } = user;
    return this.toPublicUser(safeUser);
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }): PublicUser {
    const accessToken = this.signAccessToken(user);
    return {
      ...user,
      accessToken,
    };
  }

  private signAccessToken(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }): string {
    const payload = {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    return this.jwtService.sign(payload);
  }
}
