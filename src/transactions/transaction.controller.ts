import {
  Controller,
  Get,
  Req,
  HttpCode,
  UseGuards,
  UnauthorizedException,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateTransactionDto, UpdateTransactionDto } from '../dtos/transaction.dto.js';

import { TransactionService } from './transaction.service.js';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@ApiTags('Transactions')
@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Recupère toutes les transactions (utilisateur authentifié)',
  })
  @ApiResponse({ status: 200, description: 'Liste des transactions' })
  async getTransactions(@Req() req: Request) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const transactions = await this.transactionService.findAll(authUserId);
    console.log(
      'GET /transactions user:',
      authUserId,
      'returned',
      transactions.length,
      'transactions',
    );
    return {
      message: 'List of transactions',
      transactions,
    };
  }

  @Get('recurring')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recurring transactions (deduplicated)' })
  @ApiResponse({ status: 200, description: 'Recurring transactions' })
  async getRecurring(@Req() req: Request) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException('Authenticated user id not found in token');
    }
    const transactions = await this.transactionService.findRecurring(authUserId);
    return { transactions };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new transaction (authenticated user)',
  })
  @ApiBody({ type: CreateTransactionDto })
  @ApiResponse({ status: 201, description: 'Transaction created' })
  async createTransaction(
    @Body() body: CreateTransactionDto,
    @Req() req: Request,
  ) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const transactionData = body;
    const newTransaction = await this.transactionService.createTransaction(
      authUserId,
      transactionData,
    );

    return {
      message: 'Transaction created successfully',
      newTransaction,
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a transaction' })
  @ApiBody({ type: UpdateTransactionDto })
  @ApiResponse({ status: 200, description: 'Transaction updated' })
  async updateTransaction(
    @Param('id') id: string,
    @Body() body: UpdateTransactionDto,
    @Req() req: Request,
  ) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException('Authenticated user id not found in token');
    }
    const updated = await this.transactionService.updateTransaction(authUserId, id, body);
    return { message: 'Transaction updated', transaction: updated };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiResponse({ status: 200, description: 'Transaction deleted' })
  async deleteTransaction(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException('Authenticated user id not found in token');
    }
    await this.transactionService.deleteTransaction(authUserId, id);
    return { message: 'Transaction deleted' };
  }
}
