import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ForecastsController } from './forecasts.controller.js';
import { ForecastsService } from './forecasts.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [ForecastsController],
  providers: [ForecastsService],
  exports: [ForecastsService],
})
export class ForecastsModule {}
