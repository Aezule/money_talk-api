import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId?: string): Promise<any[]> {
    const where = userId ? { userId } : {};
    const budgetClient = (this.prisma as any).budget;
    return await budgetClient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, data: any) {
    const budgetClient = (this.prisma as any).budget;

    if (!data?.categoryId) {
      throw new BadRequestException('categoryId is required');
    }
    const category = await this.prisma.category.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new BadRequestException('Category not found');
    }
    if (category.userId !== userId) {
      throw new UnauthorizedException(
        'Category does not belong to authenticated user',
      );
    }

    const parseDate = (val: any, fieldName: string) => {
      if (val === undefined || val === null) return undefined;
      const d = val instanceof Date ? val : new Date(String(val));
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException(
          `${fieldName} must be a valid ISO-8601 date or datetime`,
        );
      }
      return d;
    };

    const startDate = parseDate(data.startDate, 'startDate');
    const endDate = parseDate(data.endDate, 'endDate');

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
      throw new BadRequestException('amount must be an integer');
    }

    const payload: any = {
      categoryId: data.categoryId,
      amount,
      period: data.period,
      startDate,
      endDate,
      alertThreshold: data.alertThreshold,
      userId,
    };

    try {
      const newBudget = await budgetClient.create({ data: payload });
      if (!newBudget)
        throw new BadRequestException('Budget could not be created');
      return newBudget;
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Budget creation failed');
    }
  }

  async delete(userId: string, budgetId: string) {
    const budgetClient = (this.prisma as any).budget;
    const budget = await budgetClient.findUnique({ where: { id: budgetId } });
    if (!budget) {
      throw new BadRequestException('Budget not found');
    }
    if (budget.userId !== userId) {
      throw new UnauthorizedException(
        'Budget does not belong to authenticated user',
      );
    }
    await budgetClient.delete({ where: { id: budgetId } });
  }

  async update(userId: string, budgetId: string, data: any) {
    const budgetClient = (this.prisma as any).budget;
    const budget = await budgetClient.findUnique({ where: { id: budgetId } });
    if (!budget) {
      throw new BadRequestException('Budget not found');
    }
    if (budget.userId !== userId) {
      throw new UnauthorizedException(
        'Budget does not belong to authenticated user',
      );
    }

    const payload = { ...data };

    const updateData: any = { userId };

    if (payload.categoryId !== undefined && payload.categoryId !== null) {
      updateData.categoryId = payload.categoryId;
    }

    if (payload.amount !== undefined && payload.amount !== null) {
      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
        throw new BadRequestException('amount must be an integer');
      }
      updateData.amount = amount;
    }

    if (payload.period !== undefined) {
      updateData.period = payload.period;
    }

    if (payload.startDate !== undefined) {
      updateData.startDate = payload.startDate
        ? new Date(String(payload.startDate))
        : null;
    }

    if (payload.endDate !== undefined) {
      updateData.endDate = payload.endDate
        ? new Date(String(payload.endDate))
        : null;
    }

    if (payload.alertThreshold !== undefined) {
      updateData.alertThreshold = payload.alertThreshold;
    }

    try {
      const updated = await budgetClient.update({
        where: { id: budgetId },
        data: updateData,
      });
      if (!updated)
        throw new BadRequestException('Budget could not be updated');
      return updated;
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Budget update failed');
    }
  }
}
