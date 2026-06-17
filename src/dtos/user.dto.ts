import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ example: 'cuid', description: "L'utilisateur id" })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: "L'email de l'utilisateur",
  })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Michael', description: 'Le prénom' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'DeLaRue', description: 'Le nom' })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Date de création',
  })
  @IsDateString()
  createdAt: string;

  @ApiProperty({
    example: '2025-01-01T00:00:00.000Z',
    description: 'Date de mise à jour',
  })
  @IsDateString()
  updatedAt: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', required: true })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ required: true, minLength: 6 })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'Michael', required: true })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'DeLaRue', required: true })
  @IsString()
  @IsNotEmpty()
  lastName: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', required: true })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ModifyPasswordDto {
  @ApiProperty({
    required: true,
    minLength: 6,
    description: 'Current password',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ required: true, minLength: 6, description: 'New password' })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  newPassword: string;
}
