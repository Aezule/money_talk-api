import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ForecastsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<any[]> {
    const client = (this.prisma as any).forecastLine;
    return await client.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, data: any) {
    const client = (this.prisma as any).forecastLine;

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
      throw new BadRequestException('amount must be an integer (in cents)');
    }

    if (data.categoryId) {
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
    }

    const payload: any = {
      label: data.label,
      amount,
      type: data.type,
      categoryId: data.categoryId || null,
      userId,
    };

    try {
      const created = await client.create({ data: payload });
      if (!created)
        throw new BadRequestException('Forecast line could not be created');
      return created;
    } catch (err: any) {
      throw new BadRequestException(
        err?.message ?? 'Forecast line creation failed',
      );
    }
  }

  async update(userId: string, lineId: string, data: any) {
    const client = (this.prisma as any).forecastLine;
    const line = await client.findUnique({ where: { id: lineId } });
    if (!line) {
      throw new BadRequestException('Forecast line not found');
    }
    if (line.userId !== userId) {
      throw new UnauthorizedException(
        'Forecast line does not belong to authenticated user',
      );
    }

    const updateData: any = {};

    if (data.label !== undefined) {
      updateData.label = data.label;
    }

    if (data.amount !== undefined) {
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
        throw new BadRequestException('amount must be an integer (in cents)');
      }
      updateData.amount = amount;
    }

    if (data.type !== undefined) {
      updateData.type = data.type;
    }

    if (data.categoryId !== undefined) {
      if (data.categoryId) {
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
      }
      updateData.categoryId = data.categoryId || null;
    }

    try {
      const updated = await client.update({
        where: { id: lineId },
        data: updateData,
      });
      if (!updated)
        throw new BadRequestException('Forecast line could not be updated');
      return updated;
    } catch (err: any) {
      throw new BadRequestException(
        err?.message ?? 'Forecast line update failed',
      );
    }
  }

  async delete(userId: string, lineId: string) {
    const client = (this.prisma as any).forecastLine;
    const line = await client.findUnique({ where: { id: lineId } });
    if (!line) {
      throw new BadRequestException('Forecast line not found');
    }
    if (line.userId !== userId) {
      throw new UnauthorizedException(
        'Forecast line does not belong to authenticated user',
      );
    }
    await client.delete({ where: { id: lineId } });
  }
}
