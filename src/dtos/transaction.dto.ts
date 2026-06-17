import {
  IsDateString,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TransactionType {
  EXPENSE = 'expense',
  INCOME = 'income',
}

export class CreateTransactionDto {
  @ApiProperty({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Category Id',
    required: false,
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ example: 1200, description: 'Amount in euros' })
  @IsNumber({}, { message: 'amount must be a number' })
  amount: number;

  @ApiProperty({ example: TransactionType.EXPENSE, enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({
    example: '2022-09-27T18:00:00.000Z',
    description: 'Transaction date (ISO string)',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    example: 'Shopping',
    description: 'Transaction description',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Transaction notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    example: false,
    description: 'Mark as recurring',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class UpdateTransactionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber({}, { message: 'amount must be a number' })
  amount?: number;

  @ApiProperty({ required: false, enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
