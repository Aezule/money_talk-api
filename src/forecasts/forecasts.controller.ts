import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Req,
  Body,
  Param,
  HttpCode,
  UseGuards,
  UnauthorizedException,
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
import { ForecastsService } from './forecasts.service.js';
import {
  CreateForecastLineDto,
  UpdateForecastLineDto,
} from '../dtos/forecast-line.dto.js';

@ApiTags('Forecasts')
@Controller('forecasts')
export class ForecastsController {
  constructor(private readonly forecastsService: ForecastsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all forecast lines for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'List of forecast lines' })
  async getForecasts(@Req() req: Request) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const forecastLines = await this.forecastsService.findAll(authUserId);
    return {
      message: 'List of forecast lines',
      forecastLines,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new forecast line' })
  @ApiBody({ type: CreateForecastLineDto })
  @ApiResponse({ status: 201, description: 'Forecast line created' })
  async createForecast(
    @Body() body: CreateForecastLineDto,
    @Req() req: Request,
  ) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const newLine = await this.forecastsService.create(authUserId, body);
    return {
      message: 'Forecast line created successfully',
      forecastLine: newLine,
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a forecast line' })
  @ApiBody({ type: UpdateForecastLineDto })
  @ApiResponse({ status: 200, description: 'Forecast line updated' })
  async updateForecast(
    @Req() req: Request,
    @Body() body: UpdateForecastLineDto,
    @Param('id') lineId: string,
  ) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    const updated = await this.forecastsService.update(
      authUserId,
      lineId,
      body,
    );
    return {
      message: 'Forecast line updated successfully',
      forecastLine: updated,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a forecast line' })
  @ApiResponse({ status: 200, description: 'Forecast line deleted' })
  async deleteForecast(@Req() req: Request, @Param('id') lineId: string) {
    const authUserId = (req as any).user?.sub as string | undefined;
    if (!authUserId) {
      throw new UnauthorizedException(
        'Authenticated user id not found in token',
      );
    }
    await this.forecastsService.delete(authUserId, lineId);
    return {
      message: 'Forecast line deleted successfully',
    };
  }
}
