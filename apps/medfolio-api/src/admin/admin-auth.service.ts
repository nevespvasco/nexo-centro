import { randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  adminUsers,
  adminUsersSafeColumns,
  type Database,
} from '@nexo-centro/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import * as argon2 from 'argon2';
import { verify } from 'otplib';
import { DRIZZLE } from '../database/drizzle.constants';

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const CHALLENGE_TTL_SECONDS = 5 * 60;
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_TWO_FACTOR_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  '$2b$12$duL5msShAm4s7L0Up48vRe78HUn/7E6v5yXohDC0dZIU8en7cIVha';

interface RecoveryCodeRecord {
  hash: string;
  usedAt: string | null;
}

interface AdminChallengePayload {
  sub: string;
  typ: 'admin_2fa_challenge';
  jti: string;
}

interface SafeAdminSource {
  id: string;
  nome: string;
  email: string;
  hospitalId: string | null;
  isActive: boolean;
}

export type AdminLoginResult =
  | { status: 'challenge'; token: string; maxAgeMs: number }
  | {
      status: 'ok';
      token: string;
      maxAgeMs: number;
      admin: ReturnType<typeof safeAdmin>;
    };

@Injectable()
export class AdminAuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AdminLoginResult> {
    const [admin] = await this.db
      .select({
        id: adminUsers.id,
        nome: adminUsers.nome,
        email: adminUsers.email,
        password: adminUsers.password,
        isActive: adminUsers.isActive,
        sessionVersion: adminUsers.sessionVersion,
        hospitalId: adminUsers.hospitalId,
        loginLockedUntil: adminUsers.loginLockedUntil,
        twoFactorConfirmedAt: adminUsers.twoFactorConfirmedAt,
      })
      .from(adminUsers)
      .where(and(eq(adminUsers.email, email), isNull(adminUsers.deletedAt)))
      .limit(1);
    const passwordMatches = await bcrypt.compare(
      password,
      admin?.password ?? DUMMY_PASSWORD_HASH,
    );
    const loginLocked =
      admin?.loginLockedUntil !== null &&
      admin?.loginLockedUntil !== undefined &&
      admin.loginLockedUntil > new Date();
    if (
      !admin ||
      !passwordMatches ||
      !admin.isActive ||
      loginLocked
    ) {
      if (admin && !passwordMatches && !loginLocked) {
        await this.recordLoginFailure(admin.id);
      }
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    await this.db
      .update(adminUsers)
      .set({ failedLoginAttempts: 0, loginLockedUntil: null })
      .where(eq(adminUsers.id, admin.id));

    if (admin.twoFactorConfirmedAt) {
      const token = await this.jwtService.signAsync(
        {
          sub: admin.id,
          typ: 'admin_2fa_challenge',
          jti: randomUUID(),
        } satisfies AdminChallengePayload,
        { expiresIn: CHALLENGE_TTL_SECONDS },
      );
      return {
        status: 'challenge',
        token,
        maxAgeMs: CHALLENGE_TTL_SECONDS * 1000,
      };
    }

    return {
      status: 'ok',
      ...(await this.issueSession(admin.id, admin.sessionVersion)),
      admin: safeAdmin(admin),
    };
  }

  async loginTwoFactor(
    challengeToken: string | undefined,
    code: string,
  ): Promise<Extract<AdminLoginResult, { status: 'ok' }>> {
    const adminId = await this.verifyChallenge(challengeToken);
    const [admin] = await this.db
      .select({
        id: adminUsers.id,
        nome: adminUsers.nome,
        email: adminUsers.email,
        isActive: adminUsers.isActive,
        sessionVersion: adminUsers.sessionVersion,
        hospitalId: adminUsers.hospitalId,
        twoFactorLockedUntil: adminUsers.twoFactorLockedUntil,
      })
      .from(adminUsers)
      .where(
        and(
          eq(adminUsers.id, adminId),
          eq(adminUsers.isActive, true),
          isNull(adminUsers.deletedAt),
        ),
      )
      .limit(1);
    if (
      !admin ||
      (admin.twoFactorLockedUntil !== null &&
        admin.twoFactorLockedUntil > new Date())
    ) {
      throw new UnauthorizedException('Código inválido.');
    }
    if (!(await this.verifyTwoFactorCode(admin.id, code))) {
      await this.recordTwoFactorFailure(admin.id);
      throw new UnauthorizedException('Código inválido.');
    }

    await this.db
      .update(adminUsers)
      .set({ failedTwoFactorAttempts: 0, twoFactorLockedUntil: null })
      .where(eq(adminUsers.id, admin.id));
    return {
      status: 'ok',
      ...(await this.issueSession(admin.id, admin.sessionVersion)),
      admin: safeAdmin(admin),
    };
  }

  async me(adminUserId: string) {
    const [admin] = await this.db
      .select(adminUsersSafeColumns)
      .from(adminUsers)
      .where(
        and(
          eq(adminUsers.id, adminUserId),
          eq(adminUsers.isActive, true),
          isNull(adminUsers.deletedAt),
        ),
      )
      .limit(1);
    return admin ?? null;
  }

  async revokeAllSessions(adminUserId: string): Promise<void> {
    await this.db
      .update(adminUsers)
      .set({ sessionVersion: sql`${adminUsers.sessionVersion} + 1` })
      .where(eq(adminUsers.id, adminUserId));
  }

  private async issueSession(adminId: string, sessionVersion: number) {
    const token = await this.jwtService.signAsync(
      { sub: adminId, typ: 'admin_session', ver: sessionVersion },
      { expiresIn: SESSION_TTL_SECONDS },
    );
    return { token, maxAgeMs: SESSION_TTL_SECONDS * 1000 };
  }

  private async verifyChallenge(token: string | undefined): Promise<string> {
    if (!token) throw new UnauthorizedException('Desafio 2FA em falta.');
    let payload: unknown;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Desafio 2FA inválido ou expirado.');
    }
    if (!isAdminChallengePayload(payload)) {
      throw new UnauthorizedException('Desafio 2FA inválido.');
    }
    return payload.sub;
  }

  private async verifyTwoFactorCode(
    adminId: string,
    code: string,
  ): Promise<boolean> {
    const [admin] = await this.db
      .select({
        secret: adminUsers.twoFactorSecret,
        recoveryCodes: adminUsers.twoFactorRecoveryCodes,
      })
      .from(adminUsers)
      .where(eq(adminUsers.id, adminId))
      .limit(1);
    if (!admin?.secret) return false;

    if (/^\d{6}$/.test(code)) {
      try {
        if ((await verify({ secret: admin.secret, token: code })).valid) {
          return true;
        }
      } catch {
        // Continue with recovery-code verification.
      }
    }
    if (!admin.recoveryCodes) return false;

    let records: RecoveryCodeRecord[];
    try {
      records = JSON.parse(admin.recoveryCodes) as RecoveryCodeRecord[];
    } catch {
      return false;
    }
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (!record || record.usedAt) continue;
      if (await argon2.verify(record.hash, code)) {
        records[i] = { ...record, usedAt: new Date().toISOString() };
        const [consumed] = await this.db
          .update(adminUsers)
          .set({ twoFactorRecoveryCodes: JSON.stringify(records) })
          .where(
            and(
              eq(adminUsers.id, adminId),
              eq(adminUsers.twoFactorRecoveryCodes, admin.recoveryCodes),
            ),
          )
          .returning({ id: adminUsers.id });
        return consumed !== undefined;
      }
    }
    return false;
  }

  private async recordLoginFailure(adminId: string): Promise<void> {
    const [updated] = await this.db
      .update(adminUsers)
      .set({ failedLoginAttempts: sql`${adminUsers.failedLoginAttempts} + 1` })
      .where(eq(adminUsers.id, adminId))
      .returning({ attempts: adminUsers.failedLoginAttempts });
    if (updated && updated.attempts >= MAX_LOGIN_ATTEMPTS) {
      await this.db
        .update(adminUsers)
        .set({ loginLockedUntil: new Date(Date.now() + LOCK_MS) })
        .where(eq(adminUsers.id, adminId));
    }
  }

  private async recordTwoFactorFailure(adminId: string): Promise<void> {
    const [updated] = await this.db
      .update(adminUsers)
      .set({
        failedTwoFactorAttempts: sql`${adminUsers.failedTwoFactorAttempts} + 1`,
      })
      .where(eq(adminUsers.id, adminId))
      .returning({ attempts: adminUsers.failedTwoFactorAttempts });
    if (updated && updated.attempts >= MAX_TWO_FACTOR_ATTEMPTS) {
      await this.db
        .update(adminUsers)
        .set({ twoFactorLockedUntil: new Date(Date.now() + LOCK_MS) })
        .where(eq(adminUsers.id, adminId));
    }
  }
}

function safeAdmin(admin: SafeAdminSource) {
  return {
    id: admin.id,
    nome: admin.nome,
    email: admin.email,
    hospitalId: admin.hospitalId,
    isActive: admin.isActive,
  };
}

function isAdminChallengePayload(
  value: unknown,
): value is AdminChallengePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === 'string' &&
    payload.typ === 'admin_2fa_challenge' &&
    typeof payload.jti === 'string'
  );
}
