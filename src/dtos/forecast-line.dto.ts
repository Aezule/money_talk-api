import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ForecastLineType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export class CreateForecastLineDto {
  @ApiProperty({ example: 'Loyer', description: 'Label of the line' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    example: 85000,
    description: 'Amount in cents (integer) — e.g. €850.00 => 85000',
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number (in cents)' })
  amount: number;

  @ApiProperty({ example: ForecastLineType.EXPENSE, enum: ForecastLineType })
  @IsEnum(ForecastLineType)
  type: ForecastLineType;

  @ApiProperty({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Optional category id (for expenses)',
    required: false,
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class UpdateForecastLineDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'amount must be a number (in cents)' })
  amount?: number;

  @IsOptional()
  @IsEnum(ForecastLineType)
  type?: ForecastLineType;

  @IsOptional()
  @IsString()
  categoryId?: string | null;
}
