import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { type Database, hospitalUser, hospitals } from '@nexo-centro/db';
import type { AvailableHospital, HospitalMembership } from '@nexo-centro/schemas';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';
import { pgConstraintName, pgErrorCode } from '../common/pg-error.util';

/** Deriva as iniciais (até 2 maiúsculas) a partir do nome do hospital. */
function initialsOf(nome: string): string {
  const words = nome.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[0] ?? '').slice(0, 2).toUpperCase();
}

@Injectable()
export class HospitalsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listApproved(userId: string): Promise<HospitalMembership[]> {
    const rows = await this.db
      .select({ id: hospitals.id, nome: hospitals.nome })
      .from(hospitalUser)
      .innerJoin(hospitals, eq(hospitalUser.hospitalId, hospitals.id))
      .where(
        and(
          eq(hospitalUser.userId, userId),
          eq(hospitalUser.status, 'approved'),
          isNull(hospitalUser.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      )
      .orderBy(asc(hospitals.nome));

    return rows.map((row) => ({ ...row, initials: initialsOf(row.nome) }));
  }

  /**
   * Um utilizador "tem hospital" — e portanto pode entrar na app — apenas se
   * tiver uma adesão `approved`. Uma linha `pending` não conta: não dá acesso a
   * nada (o HospitalScopeGuard exige `approved` e o switcher só mostra `approved`),
   * por isso é tratada como "sem hospital" e o utilizador fica preso no gate.
   */
  async hasApprovedMembership(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: hospitalUser.id })
      .from(hospitalUser)
      .where(
        and(
          eq(hospitalUser.userId, userId),
          eq(hospitalUser.status, 'approved'),
          isNull(hospitalUser.deletedAt),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async listRequestable(userId: string): Promise<AvailableHospital[]> {
    // Exclui só os hospitais onde o utilizador já é `approved`; um `pending`
    // ainda aparece, para o poder escolher e passar a `approved` (via requestAccess).
    return this.db
      .select({ id: hospitals.id, nome: hospitals.nome })
      .from(hospitals)
      .leftJoin(
        hospitalUser,
        and(
          eq(hospitalUser.hospitalId, hospitals.id),
          eq(hospitalUser.userId, userId),
          eq(hospitalUser.status, 'approved'),
          isNull(hospitalUser.deletedAt),
        ),
      )
      .where(and(isNull(hospitals.deletedAt), isNull(hospitalUser.id)))
      .orderBy(asc(hospitals.nome));
  }

  async requestAccess(userId: string, hospitalId: string): Promise<{ status: 'ok' }> {
    // Self-service: escolher um hospital dá acesso imediato (sem aprovação de
    // admin). Fica `approved` para o HospitalScopeGuard e o switcher o aceitarem.
    // Se já existir uma linha não-eliminada (ex.: `pending`), promove-a a
    // `approved` em vez de inserir — evita chocar com o índice único e é idempotente.
    const [existing] = await this.db
      .select({ id: hospitalUser.id, status: hospitalUser.status })
      .from(hospitalUser)
      .where(
        and(
          eq(hospitalUser.userId, userId),
          eq(hospitalUser.hospitalId, hospitalId),
          isNull(hospitalUser.deletedAt),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status !== 'approved') {
        await this.db
          .update(hospitalUser)
          .set({ status: 'approved', approvedByUserId: userId, approvedAt: new Date() })
          .where(eq(hospitalUser.id, existing.id));
      }
      return { status: 'ok' };
    }

    try {
      await this.db.insert(hospitalUser).values({
        hospitalId,
        userId,
        status: 'approved',
        approvedByUserId: userId,
        approvedAt: new Date(),
      });
      return { status: 'ok' };
    } catch (err) {
      throw this.mapRequestError(err);
    }
  }

  private mapRequestError(err: unknown): Error {
    const constraint = pgConstraintName(err);
    if (constraint === 'hospital_user_hospital_id_user_id_uq') {
      return new BadRequestException('Já tens acesso a este hospital.');
    }
    if (pgErrorCode(err) === '23503') {
      return new BadRequestException('Hospital inválido.');
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
