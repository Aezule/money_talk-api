import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationService } from '../notifications/notification.service.js';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async findAll(userId?: string) {
    const where = userId ? { userId } : {};
    const txClient = (this.prisma as any).transaction;
    try {
      return await txClient.findMany({
        where,
        include: {
          category: true,
          attachments: true,
        },
        orderBy: { date: 'desc' },
      });
    } catch (err: any) {
      if (err?.code === 'P2021') {
        return [];
      }
      throw err;
    }
  }

  async createTransaction(userId: string, data: any) {
    const txClient = (this.prisma as any).transaction;
    const payload: any = {
      ...data,
      userId,
    };

    if (payload.date !== undefined && payload.date !== null) {
      const parsedDate =
        payload.date instanceof Date
          ? payload.date
          : new Date(String(payload.date));
      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestException('date must be a valid ISO-8601 date');
      }
      payload.date = parsedDate;
    }

    if (
      typeof payload.categoryId !== 'string' ||
      payload.categoryId.trim() === ''
    ) {
      delete payload.categoryId;
    } else {
      const category = await this.prisma.category.findUnique({
        where: { id: payload.categoryId },
      });
      if (category?.userId !== userId) {
        delete payload.categoryId;
      }
    }

    const newTransaction = await txClient.create({ data: payload });

    try {
      if (newTransaction?.categoryId) {
        await this.notificationService.checkBudgetForCategory(
          userId,
          newTransaction.categoryId,
        );
      }
    } catch (err) {
      console.error('Budget check/notification failed', err);
    }
    return newTransaction;
  }

  async updateTransaction(userId: string, transactionId: string, data: any) {
    const txClient = (this.prisma as any).transaction;
    const existing = await txClient.findUnique({
      where: { id: transactionId },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Transaction not found');
    }

    const payload = { ...data };
    if (payload.date !== undefined && payload.date !== null) {
      const parsedDate =
        payload.date instanceof Date
          ? payload.date
          : new Date(String(payload.date));
      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestException('date must be a valid ISO-8601 date');
      }
      payload.date = parsedDate;
    }

    if (payload.categoryId !== undefined) {
      if (
        typeof payload.categoryId !== 'string' ||
        payload.categoryId.trim() === ''
      ) {
        delete payload.categoryId;
      } else {
        const category = await this.prisma.category.findUnique({
          where: { id: payload.categoryId },
        });
        if (category?.userId !== userId) {
          delete payload.categoryId;
        }
      }
    }

    return txClient.update({ where: { id: transactionId }, data: payload });
  }

  async deleteTransaction(userId: string, transactionId: string) {
    const txClient = (this.prisma as any).transaction;
    const existing = await txClient.findUnique({
      where: { id: transactionId },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Transaction not found');
    }
    return txClient.delete({ where: { id: transactionId } });
  }

  async findRecurring(userId: string) {
    const txClient = (this.prisma as any).transaction;
    try {
      const transactions = await txClient.findMany({
        where: { userId, isRecurring: true },
        include: { category: true },
        orderBy: { date: 'desc' },
      });

      // Deduplicate by description+type+categoryId+amount — keep most recent
      const seen = new Map<string, any>();
      for (const tx of transactions) {
        const key = `${tx.type}::${tx.categoryId ?? ''}::${tx.amount}::${tx.description ?? ''}`;
        if (!seen.has(key)) {
          seen.set(key, tx);
        }
      }
      return Array.from(seen.values());
    } catch (err: any) {
      if (err?.code === 'P2021') return [];
      throw err;
    }
  }
}
