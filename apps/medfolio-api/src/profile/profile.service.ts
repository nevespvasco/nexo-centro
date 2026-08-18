import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { type Database, especialidades, users, usersSafeColumns } from '@nexo-centro/db';
import * as bcrypt from 'bcryptjs';
import { asc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';
import type { SafeUser } from '../auth/auth.service';

@Injectable()
export class ProfileService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listEspecialidades(): Promise<{ id: string; nome: string }[]> {
    return this.db
      .select({ id: especialidades.id, nome: especialidades.nome })
      .from(especialidades)
      .where(isNull(especialidades.deletedAt))
      .orderBy(asc(especialidades.nome));
  }

  async update(
    userId: string,
    payload: { nome: string | null; email: string; especialidadeId: string | null },
  ): Promise<SafeUser> {
    const [current] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!current) {
      throw new BadRequestException('Utilizador não encontrado.');
    }

    try {
      const [updated] = await this.db
        .update(users)
        .set({
          nome: payload.nome,
          email: payload.email,
          especialidadeId: payload.especialidadeId,
          ...(payload.email !== current.email ? { emailVerifiedAt: null } : {}),
        })
        .where(eq(users.id, userId))
        .returning(usersSafeColumns);
      return updated;
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const [user] = await this.db
      .select({ password: users.password })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      throw new BadRequestException('Password atual incorreta.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.db.update(users).set({ password: passwordHash }).where(eq(users.id, userId));
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
  }

  private mapWriteError(err: unknown): Error {
    const constraint = this.constraintNameOf(err);
    if (constraint === 'users_email_uq') {
      return new BadRequestException('Este email já está a ser utilizado.');
    }
    if (constraint === 'users_especialidade_id_especialidades_id_fk') {
      return new BadRequestException('Especialidade inválida.');
    }
    return err instanceof Error ? err : new Error(String(err));
  }

  /** Drizzle wraps the driver error as `cause` behind a generic "Failed query" message. */
  private constraintNameOf(err: unknown): string | undefined {
    const cause = err instanceof Error ? err.cause : undefined;
    return cause && typeof cause === 'object' && 'constraint' in cause
      ? (cause as { constraint?: string }).constraint
      : undefined;
  }
}
