import {
  Controller,
  Get,
  Req,
  UseGuards,
  UnauthorizedException,
  Post,
  Body,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { UserService } from './user.service.js';
import { ModifyPasswordDto } from '../dtos/user.dto.js';

@ApiTags('User')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get current user info' })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'User info retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getMe(@Req() req: Request) {
    const user = req.user as { id: string };
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.userService.find(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/modify')
  @ApiOperation({ summary: 'Modify current user info' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'User info modified successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async modifyUser(
    @Req() req: Request,
    @Body() body: { email?: string; firstName?: string; lastName?: string },
  ) {
    const user = req.user as { id: string };
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.userService.modify(user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/modify-password')
  @ApiOperation({ summary: 'Modify user password' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Password updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async modifyPassword(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: ModifyPasswordDto,
  ) {
    const user = req.user as { id: string };
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    if (id !== user.id) {
      throw new UnauthorizedException('You can only modify your own password');
    }
    return this.userService.modifyPassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/delete')
  @ApiOperation({ summary: 'Delete current user' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'User deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async deleteUser(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (id !== user.id) {
      throw new UnauthorizedException('You can only delete your own account');
    }

    return this.userService.delete(user.id);
  }
}
