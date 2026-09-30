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
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  twoFactorConfirmSchema,
} from '@nexo-centro/schemas';
import type { CookieOptions, Response } from 'express';
import { readCookie } from '../common/request-cookie';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { EnvironmentVariables } from '../config/env.validation';
import { AuthService } from './auth.service';
import {
  CHALLENGE_COOKIE,
  CSRF_COOKIE,
  SESSION_COOKIE,
} from './auth.constants';
import { CurrentUser } from './current-user.decorator';
import { type AuthenticatedRequest, JwtAuthGuard } from './jwt.guard';
import { TwoFactorService } from './two-factor.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 60_000 } })
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema))
    body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);
    if (result.status === 'challenge') {
      res.cookie(
        CHALLENGE_COOKIE,
        result.token,
        this.cookieOptions(result.maxAgeMs),
      );
      return { status: '2fa_required' as const };
    }
    res.cookie(
      SESSION_COOKIE,
      result.token,
      this.cookieOptions(result.maxAgeMs),
    );
    this.setCsrfCookie(res, result.maxAgeMs);
    return {
      status: 'ok' as const,
      user: result.user,
      mustSetupTwoFactor: result.mustSetupTwoFactor,
    };
  }

  @Post('login/2fa')
  @Throttle({ default: { limit: 5, ttl: 300_000, blockDuration: 300_000 } })
  @HttpCode(200)
  async loginTwoFactor(
    @Body(new ZodValidationPipe(twoFactorCodeSchema)) body: { code: string },
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginTwoFactor(
      readCookie(req, CHALLENGE_COOKIE),
      body.code,
    );
    res.clearCookie(CHALLENGE_COOKIE, this.cookieOptions(0));
    res.cookie(
      SESSION_COOKIE,
      result.token,
      this.cookieOptions(result.maxAgeMs),
    );
    this.setCsrfCookie(res, result.maxAgeMs);
    return {
      status: 'ok' as const,
      user: result.user,
      mustSetupTwoFactor: false,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.revokeAllSessions(userId);
    res.clearCookie(SESSION_COOKIE, this.cookieOptions(0));
    res.clearCookie(CHALLENGE_COOKIE, this.cookieOptions(0));
    res.clearCookie(CSRF_COOKIE, this.csrfCookieOptions(0));
    return { status: 'ok' as const };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() userId: string) {
    return this.authService.me(userId);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 3_600_000, blockDuration: 3_600_000 } })
  @HttpCode(200)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) body: { email: string },
  ) {
    await this.authService.forgotPassword(body.email);
    return { status: 'ok' as const };
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 3_600_000, blockDuration: 3_600_000 } })
  @HttpCode(200)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema))
    body: {
      token: string;
      password: string;
    },
  ) {
    await this.authService.resetPassword(body.token, body.password);
    return { status: 'ok' as const };
  }

  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard)
  async setupTwoFactor(@CurrentUser() userId: string) {
    return this.twoFactorService.setup(userId);
  }

  @Post('2fa/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmTwoFactor(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(twoFactorConfirmSchema)) body: { code: string },
  ) {
    const recoveryCodes = await this.twoFactorService.confirm(
      userId,
      body.code,
    );
    return { status: 'ok' as const, recoveryCodes };
  }

  @Post('2fa/skip')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async skipTwoFactor(@CurrentUser() userId: string) {
    await this.twoFactorService.skip(userId);
    return { status: 'ok' as const };
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async disableTwoFactor(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(twoFactorCodeSchema)) body: { code: string },
  ) {
    await this.twoFactorService.disable(userId, body.code);
    return { status: 'ok' as const };
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

  private setCsrfCookie(res: Response, maxAgeMs: number): void {
    res.cookie(
      CSRF_COOKIE,
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
