import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  twoFactorCodeSchema,
  twoFactorConfirmSchema,
} from '@nexo-centro/schemas';
import type { CookieOptions, Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { EnvironmentVariables } from '../config/env.validation';
import { AuthService } from './auth.service';
import { CHALLENGE_COOKIE, SESSION_COOKIE } from './auth.constants';
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
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) body: { email: string; password: string }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body.email, body.password);
    if (result.status === 'challenge') {
      res.cookie(CHALLENGE_COOKIE, result.token, this.cookieOptions(result.maxAgeMs));
      return { status: '2fa_required' as const };
    }
    res.cookie(SESSION_COOKIE, result.token, this.cookieOptions(result.maxAgeMs));
    return { status: 'ok' as const, user: result.user, mustSetupTwoFactor: result.mustSetupTwoFactor };
  }

  @Post('login/2fa')
  @HttpCode(200)
  async loginTwoFactor(
    @Body(new ZodValidationPipe(twoFactorCodeSchema)) body: { code: string },
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginTwoFactor(req.cookies?.[CHALLENGE_COOKIE], body.code);
    res.clearCookie(CHALLENGE_COOKIE, this.cookieOptions(0));
    res.cookie(SESSION_COOKIE, result.token, this.cookieOptions(result.maxAgeMs));
    return { status: 'ok' as const, user: result.user, mustSetupTwoFactor: false };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions(0));
    res.clearCookie(CHALLENGE_COOKIE, this.cookieOptions(0));
    return { status: 'ok' as const };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() userId: string) {
    return this.authService.me(userId);
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: { email: string }) {
    await this.authService.forgotPassword(body.email);
    return { status: 'ok' as const };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: { token: string; password: string },
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
    const recoveryCodes = await this.twoFactorService.confirm(userId, body.code);
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
}
