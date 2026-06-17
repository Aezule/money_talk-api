import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNotEmpty, IsEnum } from 'class-validator';

export enum CategoryType {
  EXPENSE = 'expense',
  INCOME = 'income',
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'Food', description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '#ff0000',
    description: 'Hex color',
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    example: 'shopping-cart',
    description: 'Icon name',
    required: false,
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({
    example: null,
    description: 'Parent category id',
    required: false,
  })
  @IsOptional()
  @IsString()
  parentCategoryId?: string;

  @ApiProperty({ example: CategoryType.EXPENSE, enum: CategoryType, description: 'Category type' })
  @IsEnum(CategoryType)
  type: CategoryType;
}

