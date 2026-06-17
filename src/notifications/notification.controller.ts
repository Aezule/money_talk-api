import { Controller, MessageEvent, Sse, Req, UseGuards, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { NotificationService } from './notification.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@ApiTags('Notification')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Sse('sse')
  @UseGuards(JwtAuthGuard)
  sse(@Req() req: Request): Observable<MessageEvent> {
    const authUserId = (req as any).user?.id as string | undefined;
    if(!authUserId) {
      throw new Error('Authenticated user id not found in token');
    }
    return this.notificationService.stream(authUserId);
  }


  @Get()
  @UseGuards(JwtAuthGuard)
  async getNotifications(@Req() req: Request) {
    const authUserId = (req as any).user?.id as string | undefined;
    if(!authUserId) {
      throw new Error('Authenticated user id not found in token');
    }
    const notifications = await this.notificationService.getNotifications(authUserId);
    return {
      message: 'List of notifications',
      notifications,
    };
  }
 
}
