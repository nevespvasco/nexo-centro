import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  type Database,
  passwordResetTokens,
  users,
  usersSafeColumns,
} from '@nexo-centro/db';
import * as bcrypt from 'bcryptjs';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { parseDurationMs } from '../common/duration';
import type { EnvironmentVariables } from '../config/env.validation';
import { DRIZZLE } from '../database/drizzle.constants';
import { HospitalsService } from '../hospitals/hospitals.service';
import type { ChallengePayload, SessionPayload } from './auth.constants';
import { TwoFactorService } from './two-factor.service';
import { PasswordResetMailer } from './password-reset-mailer.service';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_TWO_FACTOR_ATTEMPTS = 5;
const AUTH_LOCK_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  '$2b$12$duL5msShAm4s7L0Up48vRe78HUn/7E6v5yXohDC0dZIU8en7cIVha';

export type SafeUser = Pick<
  typeof users.$inferSelect,
  keyof typeof usersSafeColumns
> & {
  hasHospitalMembership: boolean;
};

export type LoginResult =
  | { status: 'challenge'; token: string; maxAgeMs: number }
  | {
      status: 'ok';
      token: string;
      maxAgeMs: number;
      user: SafeUser;
      mustSetupTwoFactor: boolean;
    };

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
    private readonly hospitalsService: HospitalsService,
    private readonly passwordResetMailer: PasswordResetMailer,
  ) {
    this.sessionTtlMs = parseDurationMs(
      this.configService.get('JWT_EXPIRES_IN', '7d'),
    );
    this.challengeTtlMs = parseDurationMs(
      this.configService.get('TWO_FACTOR_CHALLENGE_TTL', '5m'),
    );
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    const passwordMatches = await bcrypt.compare(
      password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );
    if (
      !user ||
      !passwordMatches ||
      (user.loginLockedUntil !== null && user.loginLockedUntil > new Date())
    ) {
      if (user && !passwordMatches) await this.recordLoginFailure(user.id);
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Conta inativa.');
    }
    await this.db
      .update(users)
      .set({ failedLoginAttempts: 0, loginLockedUntil: null })
      .where(eq(users.id, user.id));

    if (user.twoFactorConfirmedAt) {
      const payload: ChallengePayload = {
        sub: user.id,
        typ: '2fa_challenge',
        jti: randomUUID(),
      };
      const token = await this.jwtService.signAsync(payload, {
        expiresIn: this.challengeTtlMs / 1000,
      });
      return { status: 'challenge', token, maxAgeMs: this.challengeTtlMs };
    }

    const mustSetupTwoFactor = user.twoFactorPromptedAt == null;
    return {
      status: 'ok',
      ...(await this.issueSession(user.id, user.sessionVersion)),
      user: await this.toSafeUserWithMembership(user),
      mustSetupTwoFactor,
    };
  }

  async loginTwoFactor(
    challengeToken: string | undefined,
    code: string,
  ): Promise<{ token: string; maxAgeMs: number; user: SafeUser }> {
    const userId = await this.verifyChallengeToken(challengeToken);

    const [challengeUser] = await this.db
      .select({ twoFactorLockedUntil: users.twoFactorLockedUntil })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    if (
      !challengeUser ||
      (challengeUser.twoFactorLockedUntil !== null &&
        challengeUser.twoFactorLockedUntil > new Date())
    ) {
      throw new UnauthorizedException('Código inválido.');
    }

    const ok = await this.twoFactorService.verifyLoginCode(userId, code);
    if (!ok) {
      await this.recordTwoFactorFailure(userId);
      throw new UnauthorizedException('Código inválido.');
    }
    await this.db
      .update(users)
      .set({ failedTwoFactorAttempts: 0, twoFactorLockedUntil: null })
      .where(eq(users.id, userId));

    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    if (!user) {
      throw new UnauthorizedException('Utilizador não encontrado.');
    }

    return {
      ...(await this.issueSession(user.id, user.sessionVersion)),
      user: await this.toSafeUserWithMembership(user),
    };
  }

  async me(userId: string): Promise<SafeUser> {
    const [user] = await this.db
      .select(usersSafeColumns)
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    if (!user) {
      throw new UnauthorizedException('Utilizador não encontrado.');
    }
    return {
      ...user,
      hasHospitalMembership: await this.hospitalsService.hasApprovedMembership(
        user.id,
      ),
    };
  }

  async forgotPassword(email: string): Promise<void> {
    if (!this.passwordResetMailer.configured) return;
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (!user) return; // Sem enumeração de utilizadores — resposta é sempre 200.

    const rawToken = randomBytes(32).toString('hex');
    const [createdToken] = await this.db
      .insert(passwordResetTokens)
      .values({
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      })
      .returning({ id: passwordResetTokens.id });

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const resetLink = `${frontendUrl}/redefinir-password?token=${rawToken}`;
    const delivered = await this.passwordResetMailer.send(email, resetLink);
    if (!delivered) {
      await this.db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.id, createdToken.id));
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const tokenHash = hashToken(token);
    const passwordHash = await bcrypt.hash(password, 12);
    await this.db.transaction(async (tx) => {
      const [consumed] = await tx
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .returning({ userId: passwordResetTokens.userId });
      if (!consumed) {
        throw new BadRequestException('Token inválido ou expirado.');
      }
      await tx
        .update(users)
        .set({
          password: passwordHash,
          sessionVersion: sql`${users.sessionVersion} + 1`,
          failedLoginAttempts: 0,
          loginLockedUntil: null,
          failedTwoFactorAttempts: 0,
          twoFactorLockedUntil: null,
        })
        .where(eq(users.id, consumed.userId));
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, userId));
  }

  private async recordLoginFailure(userId: string): Promise<void> {
    const [updated] = await this.db
      .update(users)
      .set({ failedLoginAttempts: sql`${users.failedLoginAttempts} + 1` })
      .where(eq(users.id, userId))
      .returning({ attempts: users.failedLoginAttempts });
    if (updated && updated.attempts >= MAX_LOGIN_ATTEMPTS) {
      await this.db
        .update(users)
        .set({ loginLockedUntil: new Date(Date.now() + AUTH_LOCK_MS) })
        .where(eq(users.id, userId));
    }
  }

  private async recordTwoFactorFailure(userId: string): Promise<void> {
    const [updated] = await this.db
      .update(users)
      .set({
        failedTwoFactorAttempts: sql`${users.failedTwoFactorAttempts} + 1`,
      })
      .where(eq(users.id, userId))
      .returning({ attempts: users.failedTwoFactorAttempts });
    if (updated && updated.attempts >= MAX_TWO_FACTOR_ATTEMPTS) {
      await this.db
        .update(users)
        .set({ twoFactorLockedUntil: new Date(Date.now() + AUTH_LOCK_MS) })
        .where(eq(users.id, userId));
    }
  }

  private async toSafeUserWithMembership(
    user: typeof users.$inferSelect,
  ): Promise<SafeUser> {
    return {
      ...toSafeUser(user),
      hasHospitalMembership: await this.hospitalsService.hasApprovedMembership(
        user.id,
      ),
    };
  }

  private async issueSession(
    userId: string,
    sessionVersion: number,
  ): Promise<{ token: string; maxAgeMs: number }> {
    const payload: SessionPayload = {
      sub: userId,
      typ: 'session',
      ver: sessionVersion,
    };
    const token = await this.jwtService.signAsync(payload, {
      expiresIn: this.sessionTtlMs / 1000,
    });
    return { token, maxAgeMs: this.sessionTtlMs };
  }

  private async verifyChallengeToken(
    token: string | undefined,
  ): Promise<string> {
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

function toSafeUser(
  user: typeof users.$inferSelect,
): Omit<SafeUser, 'hasHospitalMembership'> {
  const safe: Record<string, unknown> = {};
  for (const key of Object.keys(usersSafeColumns)) {
    safe[key] = (user as Record<string, unknown>)[key];
  }
  return safe as Omit<SafeUser, 'hasHospitalMembership'>;
}
