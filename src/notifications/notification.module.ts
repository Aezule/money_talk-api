import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationController } from './notification.controller.js';
import { NotificationService } from './notification.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
