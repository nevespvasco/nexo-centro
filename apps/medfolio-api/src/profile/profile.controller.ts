import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { changePasswordSchema, updateProfileSchema } from '@nexo-centro/schemas';
import type { CookieOptions, Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { SESSION_COOKIE } from '../auth/auth.constants';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { EnvironmentVariables } from '../config/env.validation';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) {}

  @Get('especialidades')
  listEspecialidades() {
    return this.profileService.listEspecialidades();
  }

  @Patch()
  async update(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(updateProfileSchema))
    body: { nome: string | null; email: string; especialidadeId: string | null },
  ) {
    return this.profileService.update(userId, body);
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: { currentPassword: string; newPassword: string },
  ) {
    await this.profileService.changePassword(userId, body.currentPassword, body.newPassword);
    return { status: 'ok' as const };
  }

  @Delete()
  async deleteAccount(@CurrentUser() userId: string, @Res({ passthrough: true }) res: Response) {
    await this.profileService.deleteAccount(userId);
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
    return { status: 'ok' as const };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get('NODE_ENV') === 'production',
      path: '/',
      maxAge: 0,
    };
  }
}
