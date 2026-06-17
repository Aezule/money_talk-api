import {
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  public async sendMail(options: { to: string; subject: string; text: string }): Promise<void> {
    const host = this.configService.get<string>('EMAIL_HOST') ?? '127.0.0.1';
    const port = Number(this.configService.get<string>('EMAIL_PORT') ?? 587);
    const secureRaw = this.configService.get<string>('EMAIL_SECURE');
    const secure = secureRaw === 'true' || port === 465;
    const user = this.configService.get<string>('EMAIL_USER') || undefined;
    const pass = this.configService.get<string>('EMAIL_PASSWORD') || undefined;
    const from = this.configService.get<string>('EMAIL_FROM') || 'noreply@example.com';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      tls: { rejectUnauthorized: false },
    });

    try {
      await transporter.verify();
    } catch (err) {
      console.error('SMTP verification failed', {
        host,
        port,
        secure,
        hasAuth: !!user,
      });
      throw err;
    }

    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
    });
  }

 public async sendResetPasswordLink(email: string): Promise<void> {
    const payload = { email };

    const expiresInSeconds = 5 * 60;
    const token = this.jwtService.sign(payload, {
        secret: this.configService.get('JWT_VERIFICATION_TOKEN_SECRET'),
        expiresIn: `${expiresInSeconds}s`
    });

    const user = await this.prisma.utilisateur.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await this.prisma.utilisateur.update({
      where: { id: user.id },
      data: ({ resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt } as any),
    });

    const url = `${this.configService.get('EMAIL_RESET_PASSWORD_URL')}?token=${token}`;

    const text = `Bonjour, \nPour réinitialiser votre mot de passe, cliquez ici: ${url}`;

    return this.sendMail({
        to: email,
        subject: 'Réinitialiser le mot de passe',
        text
    });
}
}