import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  auditEvents,
  type Database,
  hospitalUser,
  hospitals,
} from '@nexo-centro/db';
import type {
  AvailableHospital,
  HospitalMembership,
} from '@nexo-centro/schemas';
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
          eq(hospitalUser.isActive, true),
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
      .innerJoin(hospitals, eq(hospitalUser.hospitalId, hospitals.id))
      .where(
        and(
          eq(hospitalUser.userId, userId),
          eq(hospitalUser.status, 'approved'),
          eq(hospitalUser.isActive, true),
          isNull(hospitalUser.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async listRequestable(userId: string): Promise<AvailableHospital[]> {
    // Qualquer pedido ativo, pendente ou aprovado, impede pedidos duplicados.
    return this.db
      .select({ id: hospitals.id, nome: hospitals.nome })
      .from(hospitals)
      .leftJoin(
        hospitalUser,
        and(
          eq(hospitalUser.hospitalId, hospitals.id),
          eq(hospitalUser.userId, userId),
          isNull(hospitalUser.deletedAt),
        ),
      )
      .where(and(isNull(hospitals.deletedAt), isNull(hospitalUser.id)))
      .orderBy(asc(hospitals.nome));
  }

  async requestAccess(
    userId: string,
    hospitalId: string,
  ): Promise<{ status: 'pending' }> {
    const [existing] = await this.db
      .select({
        id: hospitalUser.id,
        status: hospitalUser.status,
        isActive: hospitalUser.isActive,
      })
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
      if (existing.status === 'approved') {
        if (!existing.isActive) {
          throw new BadRequestException(
            'O acesso a este hospital está suspenso. Contacta um administrador.',
          );
        }
        throw new BadRequestException('Já tens acesso a este hospital.');
      }
      return { status: 'pending' };
    }

    try {
      await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(hospitalUser)
          .values({
            hospitalId,
            userId,
            status: 'pending',
          })
          .returning({ id: hospitalUser.id });
        await tx.insert(auditEvents).values({
          actorUserId: userId,
          hospitalId,
          action: 'hospital.membership_requested',
          entityType: 'hospital_user',
          entityId: created.id,
          after: { userId, status: 'pending' },
        });
      });
      return { status: 'pending' };
    } catch (err) {
      throw this.mapRequestError(err);
    }
  }

  async listPendingRequests(approverUserId: string, hospitalId: string) {
    await this.assertCanApprove(approverUserId, hospitalId);
    return this.db
      .select({
        id: hospitalUser.id,
        userId: hospitalUser.userId,
        requestedAt: hospitalUser.requestedAt,
      })
      .from(hospitalUser)
      .where(
        and(
          eq(hospitalUser.hospitalId, hospitalId),
          eq(hospitalUser.status, 'pending'),
          isNull(hospitalUser.deletedAt),
        ),
      )
      .orderBy(asc(hospitalUser.requestedAt));
  }

  async approveRequest(
    approverUserId: string,
    requestId: string,
  ): Promise<{ status: 'approved' }> {
    const [request] = await this.db
      .select({
        id: hospitalUser.id,
        hospitalId: hospitalUser.hospitalId,
        userId: hospitalUser.userId,
      })
      .from(hospitalUser)
      .innerJoin(hospitals, eq(hospitalUser.hospitalId, hospitals.id))
      .where(
        and(
          eq(hospitalUser.id, requestId),
          eq(hospitalUser.status, 'pending'),
          isNull(hospitalUser.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      )
      .limit(1);
    if (!request) throw new NotFoundException('Pedido não encontrado.');
    if (request.userId === approverUserId) {
      throw new ForbiddenException('Não podes aprovar o teu próprio pedido.');
    }
    await this.assertCanApprove(approverUserId, request.hospitalId);

    const approved = await this.db.transaction(async (tx) => {
      const [membership] = await tx
        .update(hospitalUser)
        .set({
          status: 'approved',
          isActive: true,
          approvedByUserId: approverUserId,
          approvedAt: new Date(),
        })
        .where(
          and(
            eq(hospitalUser.id, requestId),
            eq(hospitalUser.status, 'pending'),
            isNull(hospitalUser.deletedAt),
          ),
        )
        .returning({ id: hospitalUser.id });
      if (!membership) return undefined;
      await tx.insert(auditEvents).values({
        actorUserId: approverUserId,
        hospitalId: request.hospitalId,
        action: 'hospital.membership_approved',
        entityType: 'hospital_user',
        entityId: membership.id,
        after: { userId: request.userId, status: 'approved' },
      });
      return membership;
    });
    if (!approved) throw new BadRequestException('O pedido já foi processado.');
    return { status: 'approved' };
  }

  private async assertCanApprove(
    userId: string,
    hospitalId: string,
  ): Promise<void> {
    const [membership] = await this.db
      .select({ id: hospitalUser.id })
      .from(hospitalUser)
      .innerJoin(hospitals, eq(hospitalUser.hospitalId, hospitals.id))
      .where(
        and(
          eq(hospitalUser.userId, userId),
          eq(hospitalUser.hospitalId, hospitalId),
          eq(hospitalUser.status, 'approved'),
          eq(hospitalUser.isActive, true),
          eq(hospitalUser.canApproveMembers, true),
          isNull(hospitalUser.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      )
      .limit(1);
    if (!membership) {
      throw new ForbiddenException('Sem permissão para aprovar membros.');
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
