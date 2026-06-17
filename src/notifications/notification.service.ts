import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Subject, Observable } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';

@Injectable()
export class NotificationService implements OnModuleDestroy {
  private readonly userStreams = new Map<string, Subject<MessageEvent>>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleDestroy() {
    for (const stream of this.userStreams.values()) stream.complete();
    this.userStreams.clear();
  }

  stream(userId: string): Observable<MessageEvent> {
    if (!this.userStreams.has(userId)) {
      this.userStreams.set(userId, new Subject<MessageEvent>());
    }
    const subject = this.userStreams.get(userId)!;

    (async () => {
      try {
        const pending = await (this.prisma as any).notification.findMany({
          where: { userId, delivered: false },
          orderBy: { createdAt: 'asc' },
        });
        if (pending.length) {
          for (const p of pending) {
            subject.next({
              data: p.payload ?? { type: p.type, ...p.payload },
            } as MessageEvent);
          }
          await (this.prisma as any).notification.updateMany({
            where: { id: { in: pending.map((p: any) => p.id) } },
            data: { delivered: true, deliveredAt: new Date() },
          });
        }
      } catch (err) {
        console.error('Failed flushing pending notifications', err);
      }
    })();

    return subject.asObservable();
  }

  private async persistNotification(
    userId: string,
    type: string,
    payload: any,
    delivered: boolean,
  ) {
    return await (this.prisma as any).notification.create({
      data: {
        userId,
        type,
        payload,
        delivered,
        deliveredAt: delivered ? new Date() : null,
      },
    });
  }

  private async emitToUser(userId: string, eventData: any) {
    const subject = this.userStreams.get(userId);
    if (subject) {
      try {
        await this.persistNotification(
          userId,
          eventData.type ?? 'generic',
          eventData,
          true,
        );
        subject.next({ data: eventData } as MessageEvent);
      } catch (err) {
        console.error('Failed to persist/deliver notification', err);
      }
      return;
    }

    try {
      await this.persistNotification(
        userId,
        eventData.type ?? 'generic',
        eventData,
        false,
      );
    } catch (err) {
      console.error('Failed to persist notification for offline user', err);
    }
  }

  private computePeriodRange(
    budget: any,
    now: Date,
  ): { start: Date | null; end: Date | null } {
    const start = budget.startDate ? new Date(budget.startDate) : null;
    const end = budget.endDate ? new Date(budget.endDate) : null;

    if (start && end) return { start, end };

    switch (budget.period) {
      case 'monthly':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999,
          ),
        };
      case 'weekly': {
        const day = now.getDay() || 7;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - day + 1);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return { start: weekStart, end: weekEnd };
      }
      case 'yearly':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
        };
      default:
        return { start, end };
    }
  }

  private buildExpenseWhere(
    userId: string,
    categoryId: string,
    start: Date | null,
    end: Date | null,
  ): any {
    const where: any = { userId, categoryId, type: 'expense' };
    if (start) where.date = { gte: start };
    if (end)
      where.date = where.date ? { ...where.date, lte: end } : { lte: end };
    return where;
  }

  private async emitBudgetAlerts(budget: any, total: number) {
    if (budget.alertThreshold) {
      if (total >= budget.alertThreshold && total < budget.amount) {
        await this.emitToUser(budget.userId, {
          type: 'budget_alert',
          budgetId: budget.id,
          categoryId: budget.categoryId,
          amount: budget.amount,
          total,
          alertThreshold: budget.alertThreshold,
        });
      }
    }

    if (total > budget.amount) {
      await this.emitToUser(budget.userId, {
        type: 'budget_exceeded',
        budgetId: budget.id,
        categoryId: budget.categoryId,
        amount: budget.amount,
        total,
      });
    }
  }

  async checkBudgetForCategory(userId: string, categoryId: string) {
    const budgets = await (this.prisma as any).budget.findMany({
      where: { userId, categoryId },
    });

    const now = new Date();

    for (const budget of budgets) {
      const { start, end } = this.computePeriodRange(budget, now);
      const where = this.buildExpenseWhere(
        userId,
        budget.categoryId,
        start,
        end,
      );

      const res = await (this.prisma as any).transaction.aggregate({
        _sum: { amount: true },
        where,
      });

      await this.emitBudgetAlerts(budget, res._sum?.amount ?? 0);
    }
  }

  async getNotifications(userId: string) {
    return await (this.prisma as any).notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
