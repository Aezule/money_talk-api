import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
