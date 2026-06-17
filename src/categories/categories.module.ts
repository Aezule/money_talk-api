import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
