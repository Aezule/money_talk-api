import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BudgetPeriod {
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
  YEARLY = 'yearly',
}

export class CreateBudgetDto {
  @ApiProperty({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Category id',
  })
  @IsString()
  categoryId: string;

  @ApiProperty({
    example: 120000,
    description: 'Amount in cents (integer) — e.g. €1,200.00 => 120000',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number (in cents)' })
  amount: number;

  @ApiProperty({ example: BudgetPeriod.MONTHLY, enum: BudgetPeriod })
  @IsEnum(BudgetPeriod)
  period: BudgetPeriod;

  @ApiProperty({
    example: '2025-01-01',
    description: 'ISO date (start)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    example: '2025-12-31',
    description: 'ISO date (end)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    example: 80,
    description: 'Alert threshold as absolute amount (same unit as amount)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  alertThreshold?: number;
}

export class UpdateBudgetDto {
  @IsOptional()
  @IsNumber({}, { message: 'amount must be a number (in cents)' })
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsEnum(BudgetPeriod)
  period?: BudgetPeriod;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  alertThreshold?: number;
}

export class BudgetDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  userId: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  categoryId: string;

  @ApiProperty({ example: 120000, description: 'Amount in cents' })
  amount: number;

  @ApiProperty({ example: BudgetPeriod.MONTHLY, enum: BudgetPeriod })
  period: BudgetPeriod;

  @ApiProperty({ example: '2025-01-01', required: false })
  startDate?: string;

  @ApiProperty({ example: '2025-12-31', required: false })
  endDate?: string;

  @ApiProperty({ example: 80, required: false })
  alertThreshold?: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2024-01-02T00:00:00.000Z' })
  updatedAt: string;
}
