import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { adminLoginSchema, twoFactorCodeSchema } from '@nexo-centro/schemas';
import type { CookieOptions, Response } from 'express';
import {
  ADMIN_CHALLENGE_COOKIE,
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
} from '../auth/auth.constants';
import { readCookie } from '../common/request-cookie';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard, type AdminRequest } from './admin.guard';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 60_000 } })
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(adminLoginSchema))
    body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.adminAuthService.login(body.email, body.password);
    if (result.status === 'challenge') {
      res.cookie(
        ADMIN_CHALLENGE_COOKIE,
        result.token,
        this.cookieOptions(result.maxAgeMs),
      );
      return { status: '2fa_required' as const };
    }
    this.establishSession(res, result.token, result.maxAgeMs);
    return { status: 'ok' as const, admin: result.admin };
  }

  @Post('login/2fa')
  @Throttle({ default: { limit: 5, ttl: 300_000, blockDuration: 300_000 } })
  @HttpCode(200)
  async loginTwoFactor(
    @Body(new ZodValidationPipe(twoFactorCodeSchema)) body: { code: string },
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.adminAuthService.loginTwoFactor(
      readCookie(req, ADMIN_CHALLENGE_COOKIE),
      body.code,
    );
    res.clearCookie(ADMIN_CHALLENGE_COOKIE, this.cookieOptions(0));
    this.establishSession(res, result.token, result.maxAgeMs);
    return { status: 'ok' as const, admin: result.admin };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AdminGuard)
  async logout(
    @Req() req: AdminRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.adminAuthService.revokeAllSessions(req.adminUserId);
    res.clearCookie(ADMIN_SESSION_COOKIE, this.cookieOptions(0));
    res.clearCookie(ADMIN_CHALLENGE_COOKIE, this.cookieOptions(0));
    res.clearCookie(ADMIN_CSRF_COOKIE, this.csrfCookieOptions(0));
    return { status: 'ok' as const };
  }

  @Get('me')
  @UseGuards(AdminGuard)
  async me(@Req() req: AdminRequest) {
    return this.adminAuthService.me(req.adminUserId);
  }

  private cookieOptions(maxAgeMs: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get('NODE_ENV') === 'production',
      path: '/',
      maxAge: maxAgeMs,
    };
  }

  private establishSession(
    res: Response,
    token: string,
    maxAgeMs: number,
  ): void {
    res.cookie(
      ADMIN_SESSION_COOKIE,
      token,
      this.cookieOptions(maxAgeMs),
    );
    res.cookie(
      ADMIN_CSRF_COOKIE,
      randomBytes(32).toString('base64url'),
      this.csrfCookieOptions(maxAgeMs),
    );
  }

  private csrfCookieOptions(maxAgeMs: number): CookieOptions {
    return {
      httpOnly: false,
      sameSite: 'strict',
      secure: this.configService.get('NODE_ENV') === 'production',
      path: '/',
      maxAge: maxAgeMs,
    };
  }
}
