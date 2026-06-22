// Test d'INTÉGRATION HTTP
import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailService } from '../email/email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Substitut en mémoire de PrismaService. `findUnique` / `findFirst` filtrent
 * sur n'importe quelle clé passée par le service (email, id, tokenHash, ...).
 */
class InMemoryPrisma {
  utilisateurs: any[] = [];
  refreshTokens: any[] = [];
  private seq = 0;

  private matchOne(rows: any[], where: any) {
    return (
      rows.find((row) =>
        Object.keys(where).every((k) => row[k] === where[k]),
      ) ?? null
    );
  }

  // Imite le `select` de Prisma : ne renvoie que les champs demandés (ainsi le
  // hash du mot de passe ne fuite jamais s'il n'est pas explicitement sélectionné).
  private project(row: any, select?: any) {
    if (!row || !select) return row;
    const out: any = {};
    for (const key of Object.keys(select)) {
      if (select[key]) out[key] = row[key];
    }
    return out;
  }

  utilisateur = {
    findUnique: ({ where, select }: any) =>
      Promise.resolve(
        this.project(this.matchOne(this.utilisateurs, where), select),
      ),
    findFirst: ({ where, select }: any) =>
      Promise.resolve(
        this.project(this.matchOne(this.utilisateurs, where), select),
      ),
    create: ({ data, select }: any) => {
      const row = { ...data };
      this.utilisateurs.push(row);
      return Promise.resolve(this.project(row, select));
    },
    update: ({ where, data }: any) => {
      const row = this.matchOne(this.utilisateurs, where);
      Object.assign(row, data);
      return Promise.resolve(row);
    },
  };

  refreshToken = {
    findUnique: ({ where }: any) =>
      Promise.resolve(this.matchOne(this.refreshTokens, where)),
    create: ({ data }: any) => {
      const row = { id: `rt-${++this.seq}`, revoked: false, ...data };
      this.refreshTokens.push(row);
      return Promise.resolve(row);
    },
    update: ({ where, data }: any) => {
      const row = this.matchOne(this.refreshTokens, where);
      Object.assign(row, data);
      return Promise.resolve(row);
    },
  };
}

describe('Auth (integration)', () => {
  let app: INestApplication;
  let prisma: InMemoryPrisma;

  beforeEach(async () => {
    prisma = new InMemoryPrisma();

    const jwt = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
      verify: jest.fn().mockReturnValue({ sub: 'u1' }),
    };
    const emailService = {
      sendResetPasswordLink: jest.fn<any>().mockResolvedValue(undefined),
    };
    const config = { get: jest.fn().mockReturnValue('secret') };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const signupBody = {
    email: 'new@example.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Doe',
  };

  it('POST /auth/signup creates a user, hashes the password and sets a refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(signupBody)
      .expect(201);

    expect(res.body.message).toBe('User created successfully');
    expect(res.body.user).toMatchObject({
      email: 'new@example.com',
      accessToken: 'signed.jwt.token',
    });
    expect(res.body.user).not.toHaveProperty('password');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);

    // Le mot de passe est stocké haché, jamais en clair.
    expect(prisma.utilisateurs[0].password).not.toBe('password123');
  });

  it('POST /auth/signup rejects a duplicate email (409)', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(signupBody)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(signupBody)
      .expect(409);
  });

  it('POST /auth/signup rejects an invalid body via ValidationPipe (400)', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: '123' })
      .expect(400);
  });

  it('POST /auth/login returns the user and sets access + refresh cookies', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(signupBody)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: signupBody.email, password: signupBody.password })
      .expect(201);

    expect(res.body.message).toBe('User logged in successfully');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('POST /auth/login rejects a wrong password (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send(signupBody)
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: signupBody.email, password: 'wrong-password' })
      .expect(401);
  });

  it('POST /auth/refresh rejects a request without a refresh cookie (401)', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').expect(401);
  });

  it('POST /auth/refresh rotates the token when a valid cookie is presented', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/signup').send(signupBody).expect(201);

    const res = await agent.post('/auth/refresh').expect(200);

    expect(res.body.accessToken).toBe('signed.jwt.token');
    // Le token d'origine est révoqué, un nouveau est émis (rotation).
    expect(prisma.refreshTokens).toHaveLength(2);
    expect(prisma.refreshTokens[0].revoked).toBe(true);
  });

  it('POST /auth/logout revokes the refresh token and returns 204', async () => {
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/signup').send(signupBody).expect(201);

    await agent.post('/auth/logout').expect(204);

    expect(prisma.refreshTokens[0].revoked).toBe(true);
  });

  it('POST /auth/forgot-password always returns a neutral message', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'unknown@example.com' })
      .expect(201);

    expect(res.body.message).toContain('Si un compte existe');
  });
});
