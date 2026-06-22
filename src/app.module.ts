import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TransactionModule } from './transactions/transaction.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { BudgetsModule } from './budgets/budgets.module.js';
import { UserModule } from './user/user.module.js';
import { NotificationModule } from './notifications/notification.module.js';
import { ForecastsModule } from './forecasts/forecasts.module.js';
import { MetricsModule } from './metrics/metrics.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Logs structurés JSON (centralisables via Loki/Promtail).
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Ne jamais logger les secrets transitant dans les en-têtes :
        // - requête : Authorization (Bearer) et Cookie (refreshToken)
        // - réponse : Set-Cookie (refreshToken + accessToken JWT)
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        autoLogging: { ignore: (req) => req.url === '/metrics' },
      },
    }),
    MetricsModule,
    PrismaModule,
    AuthModule,
    TransactionModule,
    CategoriesModule,
    BudgetsModule,
    UserModule,
    NotificationModule,
    ForecastsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
