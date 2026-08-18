import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Database, passwordResetTokens, users, usersSafeColumns } from '@nexo-centro/db';
import * as bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { parseDurationMs } from '../common/duration';
import type { EnvironmentVariables } from '../config/env.validation';
import { DRIZZLE } from '../database/drizzle.constants';
import type { ChallengePayload, SessionPayload } from './auth.constants';
import { TwoFactorService } from './two-factor.service';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

export type SafeUser = Pick<typeof users.$inferSelect, keyof typeof usersSafeColumns>;

export type LoginResult =
  | { status: 'challenge'; token: string; maxAgeMs: number }
  | { status: 'ok'; token: string; maxAgeMs: number; user: SafeUser; mustSetupTwoFactor: boolean };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly sessionTtlMs: number;
  private readonly challengeTtlMs: number;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables>,
    private readonly twoFactorService: TwoFactorService,
  ) {
    this.sessionTtlMs = parseDurationMs(this.configService.get('JWT_EXPIRES_IN', '7d'));
    this.challengeTtlMs = parseDurationMs(this.configService.get('TWO_FACTOR_CHALLENGE_TTL', '5m'));
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Conta inativa.');
    }

    if (user.twoFactorConfirmedAt) {
      const payload: ChallengePayload = { sub: user.id, typ: '2fa_challenge' };
      const token = await this.jwtService.signAsync(payload, { expiresIn: this.challengeTtlMs / 1000 });
      return { status: 'challenge', token, maxAgeMs: this.challengeTtlMs };
    }

    const mustSetupTwoFactor = user.twoFactorPromptedAt == null;
    return {
      status: 'ok',
      ...(await this.issueSession(user.id)),
      user: toSafeUser(user),
      mustSetupTwoFactor,
    };
  }

  async loginTwoFactor(
    challengeToken: string | undefined,
    code: string,
  ): Promise<{ token: string; maxAgeMs: number; user: SafeUser }> {
    const userId = await this.verifyChallengeToken(challengeToken);

    const ok = await this.twoFactorService.verifyLoginCode(userId, code);
    if (!ok) {
      throw new UnauthorizedException('Código inválido.');
    }

    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      throw new UnauthorizedException('Utilizador não encontrado.');
    }

    return { ...(await this.issueSession(user.id)), user: toSafeUser(user) };
  }

  async me(userId: string): Promise<SafeUser> {
    const [user] = await this.db
      .select(usersSafeColumns)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new UnauthorizedException('Utilizador não encontrado.');
    }
    return user;
  }

  async forgotPassword(email: string): Promise<void> {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (!user) return; // Sem enumeração de utilizadores — resposta é sempre 200.

    const rawToken = randomBytes(32).toString('hex');
    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    });

    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:5173');
    const resetLink = `${frontendUrl}/redefinir-password?token=${rawToken}`;
    // Sem SMTP em dev — o link fica visível nos logs do container `api`.
    console.log(`[auth] Link de reset de password para ${email}: ${resetLink}`);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const tokenHash = hashToken(token);
    const [resetToken] = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.db.transaction(async (tx) => {
      await tx.update(users).set({ password: passwordHash }).where(eq(users.id, resetToken.userId));
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));
    });
  }

  private async issueSession(userId: string): Promise<{ token: string; maxAgeMs: number }> {
    const payload: SessionPayload = { sub: userId, typ: 'session' };
    const token = await this.jwtService.signAsync(payload, { expiresIn: this.sessionTtlMs / 1000 });
    return { token, maxAgeMs: this.sessionTtlMs };
  }

  private async verifyChallengeToken(token: string | undefined): Promise<string> {
    if (!token) {
      throw new UnauthorizedException('Desafio de 2FA não encontrado.');
    }
    let payload: ChallengePayload;
    try {
      payload = await this.jwtService.verifyAsync<ChallengePayload>(token);
    } catch {
      throw new UnauthorizedException('Desafio de 2FA inválido ou expirado.');
    }
    if (payload.typ !== '2fa_challenge') {
      throw new UnauthorizedException('Desafio de 2FA inválido.');
    }
    return payload.sub;
  }
}

function toSafeUser(user: typeof users.$inferSelect): SafeUser {
  const safe: Record<string, unknown> = {};
  for (const key of Object.keys(usersSafeColumns)) {
    safe[key] = (user as Record<string, unknown>)[key];
  }
  return safe as SafeUser;
}
