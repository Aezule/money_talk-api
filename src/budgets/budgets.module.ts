import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BudgetsController } from './budgets.controller.js';
import { BudgetsService } from './budgets.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
