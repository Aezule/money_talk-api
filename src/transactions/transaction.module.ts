import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TransactionController } from './transaction.controller.js';
import { TransactionService } from './transaction.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationModule } from '../notifications/notification.module.js';

@Module({
  imports: [ConfigModule, AuthModule, NotificationModule],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
