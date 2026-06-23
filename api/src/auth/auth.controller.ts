import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

import { AuthResult, AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const COOKIE_NAME = 'sf_refresh';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
};

@Controller({ version: '1', path: 'auth' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 attempts per 15 minutes
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResult, 'refreshToken'>> {
    const result = await this.auth.register(dto);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...rest } = result;
    return rest;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 attempts per 15 minutes
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResult, 'refreshToken'>> {
    const result = await this.auth.login(dto);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...rest } = result;
    return rest;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResult, 'refreshToken'>> {
    const raw: unknown = (req.cookies as Record<string, unknown>)[COOKIE_NAME];
    if (typeof raw !== 'string' || !raw) {
      throw new UnauthorizedException('No refresh token');
    }
    const result = await this.auth.refresh(raw);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...rest } = result;
    return rest;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const raw: unknown = (req.cookies as Record<string, unknown>)[COOKIE_NAME];
    if (typeof raw === 'string' && raw) {
      await this.auth.logout(raw);
    }
    res.clearCookie(COOKIE_NAME, { path: COOKIE_OPTS.path });
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  }
}
