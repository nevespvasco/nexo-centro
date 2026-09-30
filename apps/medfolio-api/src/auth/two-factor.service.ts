import { randomBytes } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { type Database, users } from '@nexo-centro/db';
import { and, eq, isNull } from 'drizzle-orm';
import { generateSecret, generateURI, verify } from 'otplib';
import * as QRCode from 'qrcode';
import * as argon2 from 'argon2';
import { DRIZZLE } from '../database/drizzle.constants';

const RECOVERY_CODE_COUNT = 8;

interface RecoveryCodeRecord {
  hash: string;
  usedAt: string | null;
}

/** otplib throws on malformed input instead of returning `valid: false` — recovery codes
 * (with a dash, non-numeric) would otherwise crash verifyLoginCode(). */
async function verifyTotp(secret: string, token: string): Promise<boolean> {
  if (!/^\d{6}$/.test(token)) return false;
  try {
    return (await verify({ secret, token })).valid;
  } catch {
    return false;
  }
}

function generateRecoveryCode(): string {
  return (
    randomBytes(5)
      .toString('hex')
      .toUpperCase()
      .match(/.{1,5}/g)
      ?.join('-') ?? ''
  );
}

@Injectable()
export class TwoFactorService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async setup(
    userId: string,
  ): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
    const [user] = await this.db
      .select({
        email: users.email,
        twoFactorConfirmedAt: users.twoFactorConfirmedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new BadRequestException('Utilizador não encontrado.');
    }
    if (user.twoFactorConfirmedAt) {
      throw new BadRequestException(
        'Desativa primeiro a verificação atual antes de configurar uma nova.',
      );
    }

    const secret = generateSecret();
    await this.db
      .update(users)
      .set({ pendingTwoFactorSecret: secret })
      .where(eq(users.id, userId));

    const otpauthUrl = generateURI({
      issuer: 'Medfolio',
      label: user.email,
      secret,
    });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrDataUrl };
  }

  async confirm(userId: string, code: string): Promise<string[]> {
    const [user] = await this.db
      .select({ pendingTwoFactorSecret: users.pendingTwoFactorSecret })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.pendingTwoFactorSecret) {
      throw new BadRequestException('Configuração de 2FA não foi iniciada.');
    }
    if (!(await verifyTotp(user.pendingTwoFactorSecret, code))) {
      throw new BadRequestException('Código inválido.');
    }

    const plainCodes = Array.from(
      { length: RECOVERY_CODE_COUNT },
      generateRecoveryCode,
    );
    const records: RecoveryCodeRecord[] = await Promise.all(
      plainCodes.map(async (plainCode) => ({
        hash: await argon2.hash(plainCode),
        usedAt: null,
      })),
    );

    await this.db
      .update(users)
      .set({
        twoFactorSecret: user.pendingTwoFactorSecret,
        pendingTwoFactorSecret: null,
        twoFactorConfirmedAt: new Date(),
        twoFactorPromptedAt: new Date(),
        twoFactorRecoveryCodes: JSON.stringify(records),
      })
      .where(eq(users.id, userId));

    return plainCodes;
  }

  async skip(userId: string): Promise<void> {
    const [updated] = await this.db
      .update(users)
      .set({ twoFactorPromptedAt: new Date(), pendingTwoFactorSecret: null })
      .where(and(eq(users.id, userId), isNull(users.twoFactorConfirmedAt)))
      .returning({ id: users.id });
    if (!updated) {
      throw new BadRequestException(
        'Uma verificação já confirmada não pode ser ignorada.',
      );
    }
  }

  async disable(userId: string, code: string): Promise<void> {
    if (!(await this.verifyLoginCode(userId, code))) {
      throw new BadRequestException('Código inválido.');
    }
    await this.db
      .update(users)
      .set({
        twoFactorSecret: null,
        pendingTwoFactorSecret: null,
        twoFactorConfirmedAt: null,
        twoFactorPromptedAt: null,
        twoFactorRecoveryCodes: null,
      })
      .where(eq(users.id, userId));
  }

  /** Verifica um código TOTP ou, em alternativa, um código de recuperação (one-time-use). */
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const [user] = await this.db
      .select({
        twoFactorSecret: users.twoFactorSecret,
        twoFactorRecoveryCodes: users.twoFactorRecoveryCodes,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.twoFactorSecret) return false;

    if (await verifyTotp(user.twoFactorSecret, code)) {
      return true;
    }

    if (!user.twoFactorRecoveryCodes) return false;
    let records: RecoveryCodeRecord[];
    try {
      records = JSON.parse(user.twoFactorRecoveryCodes) as RecoveryCodeRecord[];
    } catch {
      return false;
    }
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (record.usedAt) continue;
      if (await argon2.verify(record.hash, code)) {
        records[i] = { ...record, usedAt: new Date().toISOString() };
        const [consumed] = await this.db
          .update(users)
          .set({ twoFactorRecoveryCodes: JSON.stringify(records) })
          .where(
            and(
              eq(users.id, userId),
              eq(users.twoFactorRecoveryCodes, user.twoFactorRecoveryCodes),
            ),
          )
          .returning({ id: users.id });
        return consumed !== undefined;
      }
    }
    return false;
  }
}
