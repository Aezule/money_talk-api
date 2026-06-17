import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { CreateUserDto, LoginDto } from '../dtos/user.dto.js';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getRefreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };
  }

  @Post('signup')
  @ApiOperation({ summary: 'Créer un nouvel utilisateur' })
  @ApiResponse({ status: 201, description: 'User created' })
  @ApiBody({ type: CreateUserDto })
  async signup(
    @Body() body: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password, firstName, lastName } = body;
    const user = await this.authService.createUser(
      email,
      password,
      firstName,
      lastName,
    );

    const refreshRaw = await this.authService.generateRefreshToken(user.id);
    res.cookie('refreshToken', refreshRaw, this.getRefreshCookieOptions());

    return {
      message: 'User created successfully',
      user,
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Authentifier un utilisateur' })
  @ApiResponse({ status: 200, description: 'User logged in' })
  @ApiBody({ type: LoginDto })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = body;
    const user = await this.authService.loginUser(email, password);

    const refreshRaw = await this.authService.generateRefreshToken(user.id);
    res.cookie('refreshToken', refreshRaw, this.getRefreshCookieOptions());

    const accessCookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    } as any;
    res.cookie('accessToken', user.accessToken, accessCookieOptions);

    return {
      message: 'User logged in successfully',
      user,
    };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.refreshToken;
    if (!raw) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const { user, refreshRaw } =
      await this.authService.verifyAndRotateRefreshToken(raw);

    res.cookie('refreshToken', refreshRaw, this.getRefreshCookieOptions());

    const accessCookieOptions = {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 minutes
    } as any;
    res.cookie('accessToken', user.accessToken, accessCookieOptions);

    return { accessToken: user.accessToken, user };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.refreshToken;
    if (raw) {
      await this.authService.revokeRefreshToken(raw);
    }
    res.clearCookie('refreshToken', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Demander une réinitialisation de mot de passe' })
  @ApiResponse({ status: 200, description: 'Password reset requested' })
  @ApiBody({ schema: { properties: { email: { type: 'string' } } } })
  async forgotPassword(@Body('email') email: string) {
    await this.authService.forgetPassword(email);
    return {
      message:
        'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
    };
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Réinitialiser le mot de passe' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiBody({
    schema: {
      properties: { token: { type: 'string' }, password: { type: 'string' } },
    },
  })
  async resetPassword(@Body() body: { token: string; password: string }) {
    await this.authService.resetPassword(body.token, body.password);
    return { message: 'Réinitialisation du mot de passe réussie.' };
  }
}
