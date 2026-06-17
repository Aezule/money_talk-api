import {
  Controller,
  Get,
  Req,
  HttpCode,
  UseGuards,
  UnauthorizedException,
  Post,
  Body,
  Delete,
  Put,
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
import { BudgetsService } from './budgets.service.js';
import { CreateBudgetDto, UpdateBudgetDto } from '../dtos/budget.dto.js';

@ApiTags('Budgets')
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetService: BudgetsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all budgets for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of budgets' })
  async getBudgets(@Req() req: Request) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const budgets = await this.budgetService.findAll(authUserId);
    return {
      message: 'List of budgets',
      budgets,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new budget for the authenticated user' })
  @ApiBody({ type: CreateBudgetDto })
  @ApiResponse({ status: 201, description: 'Budget created' })
  async createBudget(@Body() body: CreateBudgetDto, @Req() req: Request) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const newBudget = await this.budgetService.create(authUserId, body);
    return {
      message: 'Budget created successfully',
      newBudget,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a budget for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Budget deleted' })
  async deleteBudget(@Req() req: Request, @Param('id') budgetId: string) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    await this.budgetService.delete(authUserId, budgetId);
    return {
      message: 'Budget deleted successfully',
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a budget for the authenticated user' })
  @ApiBody({ type: UpdateBudgetDto })
  @ApiResponse({ status: 200, description: 'Budget updated' })
  async updateBudget(
    @Req() req: Request,
    @Body() body: UpdateBudgetDto,
    @Body('budgetId') budgetIdFromBody: string,
  ) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const budgetId = budgetIdFromBody || (req as any).params?.id;
    const updatedBudget = await this.budgetService.update(
      authUserId,
      budgetId,
      body,
    );
    return {
      message: 'Budget updated successfully',
      updatedBudget,
    };
  }
}
