import {
  Controller,
  Get,
  Req,
  HttpCode,
  UseGuards,
  UnauthorizedException,
  Post,
  Body,
  Put,
  Delete,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from '../dtos/category.dto.js';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all categories (authenticated user)',
  })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async getCategories(@Req() req: Request) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const categories = await this.categoriesService.findAll(authUserId);
    return {
      message: 'List of categories',
      categories,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new category (authenticated user)',
  })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ status: 201, description: 'Category created' })
  async createCategory(@Body() body: CreateCategoryDto, @Req() req: Request) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const newCategory = await this.categoriesService.create(authUserId, body);
    return {
      message: 'Category created successfully',
      newCategory,
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a category (authenticated user)',
  })
  @ApiResponse({ status: 200, description: 'Category updated' })
  async updateCategory(
    @Param('id') id: string,
    @Body() body: Partial<CreateCategoryDto>,
    @Req() req: Request,
  ) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const category = await this.categoriesService.update(authUserId, id, body);
    return {
      message: 'Category updated successfully',
      category,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a category (authenticated user)',
  })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  async deleteCategory(@Param('id') id: string, @Req() req: Request) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    await this.categoriesService.remove(authUserId, id);
    return {
      message: 'Category deleted successfully',
    };
  }
}
