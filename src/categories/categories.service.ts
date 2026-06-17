import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId?: string) {
    const where = userId ? { userId } : {};
    const categoryClient = (this.prisma as any).category;
    return await categoryClient.findMany({ where, orderBy: { name: 'asc' } });
  }

  async create(userId: string, data: any) {
    const name = (data?.name ?? '').trim();
    if (!name) {
      throw new BadRequestException('Category name is required');
    }

    const type = data?.type ?? 'expense';

    if (data?.parentCategoryId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: data.parentCategoryId },
      });
      if (!parent) {
        throw new BadRequestException('Parent category not found');
      }
      if (parent.userId !== userId) {
        throw new UnauthorizedException(
          'Parent category does not belong to authenticated user',
        );
      }
    }

    const existing = await this.prisma.category.findMany({
      where: { userId, type },
      select: { id: true, name: true },
    });
    const normalized = name.toLowerCase();
    if (existing.some((cat) => cat.name.trim().toLowerCase() === normalized)) {
      throw new ConflictException('Category already exists');
    }

    const payload = {
      ...data,
      name,
      type,
      userId,
    };

    const categoryClient = (this.prisma as any).category;
    const newCategory = await categoryClient.create({
      data: payload,
    });

    return newCategory;
  }

  async update(userId: string, categoryId: string, data: any) {
    const categoryClient = (this.prisma as any).category;

    const existingCategory = await categoryClient.findUnique({
      where: { id: categoryId },
    });
    if (!existingCategory) {
      throw new NotFoundException('Category not found');
    }
    if (existingCategory.userId !== userId) {
      throw new UnauthorizedException(
        'Category does not belong to authenticated user',
      );
    }

    const nextNameRaw =
      data?.name !== undefined ? String(data.name) : existingCategory.name;
    const nextName = nextNameRaw.trim();
    if (!nextName) {
      throw new BadRequestException('Category name is required');
    }

    const type = existingCategory.type ?? 'expense';
    const normalized = nextName.toLowerCase();
    const existing = await categoryClient.findMany({
      where: { userId, type },
      select: { id: true, name: true },
    });
    if (
      existing.some(
        (cat: any) =>
          cat.id !== categoryId && cat.name.trim().toLowerCase() === normalized,
      )
    ) {
      throw new ConflictException('Category already exists');
    }

    const payload: Record<string, any> = {
      name: nextName,
    };

    if (data?.color !== undefined) {
      payload.color = data.color || null;
    }
    if (data?.icon !== undefined) {
      payload.icon = data.icon || null;
    }

    const updatedCategory = await categoryClient.update({
      where: { id: categoryId },
      data: payload,
    });

    return updatedCategory;
  }

  async remove(userId: string, categoryId: string) {
    const categoryClient = (this.prisma as any).category;
    const txClient = (this.prisma as any).transaction;
    const budgetClient = (this.prisma as any).budget;

    const existingCategory = await categoryClient.findUnique({
      where: { id: categoryId },
    });
    if (!existingCategory) {
      throw new NotFoundException('Category not found');
    }
    if (existingCategory.userId !== userId) {
      throw new UnauthorizedException(
        'Category does not belong to authenticated user',
      );
    }

    await this.prisma.$transaction(async () => {
      await budgetClient.deleteMany({ where: { userId, categoryId } });
      await txClient.updateMany({
        where: { userId, categoryId },
        data: { categoryId: null },
      });
      await categoryClient.delete({ where: { id: categoryId } });
    });
  }
}
