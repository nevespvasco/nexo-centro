import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  auditEvents,
  hospitalUser,
  hospitals,
  users,
  type Database,
} from '@nexo-centro/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';

@Injectable()
export class AdminUsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listUsers(
    adminHospitalId: string | null,
    limit: number,
    offset: number,
  ) {
    const pageSize = Math.min(Math.max(limit, 1), 100);
    const pageOffset = Math.max(offset, 0);
    if (adminHospitalId) {
      // Admin de hospital — apenas utilizadores do seu hospital
      const rows = await this.db
        .select({
          id: users.id,
          nome: users.nome,
          email: users.email,
          isActive: hospitalUser.isActive,
          createdAt: users.createdAt,
          hospitalId: hospitalUser.hospitalId,
        })
        .from(users)
        .innerJoin(
          hospitalUser,
          and(
            eq(hospitalUser.userId, users.id),
            eq(hospitalUser.hospitalId, adminHospitalId),
            eq(hospitalUser.status, 'approved'),
            isNull(hospitalUser.deletedAt),
          ),
        )
        .where(isNull(users.deletedAt))
        .limit(pageSize)
        .offset(pageOffset);
      return rows;
    }
    // Super-admin — todos os utilizadores
    const rows = await this.db
      .select({
        id: users.id,
        nome: users.nome,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .limit(pageSize)
      .offset(pageOffset);
    return rows;
  }

  async setActive(
    adminHospitalId: string | null,
    userId: string,
    isActive: boolean,
    adminUserId: string,
  ) {
    if (adminHospitalId) {
      const changed = await this.db.transaction(async (tx) => {
        const [membership] = await tx
          .update(hospitalUser)
          .set({ isActive })
          .where(
            and(
              eq(hospitalUser.userId, userId),
              eq(hospitalUser.hospitalId, adminHospitalId),
              eq(hospitalUser.status, 'approved'),
              isNull(hospitalUser.deletedAt),
            ),
          )
          .returning({ id: hospitalUser.id });
        if (!membership) return undefined;
        await tx.insert(auditEvents).values({
          actorAdminUserId: adminUserId,
          hospitalId: adminHospitalId,
          action: 'admin.membership_status_changed',
          entityType: 'hospital_user',
          entityId: membership.id,
          after: { userId, isActive },
        });
        return { id: userId, isActive };
      });
      if (!changed) {
        throw new ForbiddenException(
          'Sem permissão para gerir este utilizador.',
        );
      }
      return changed;
    }

    const updated = await this.db.transaction(async (tx) => {
      const [changed] = await tx
        .update(users)
        .set({
          isActive,
          sessionVersion: sql`${users.sessionVersion} + 1`,
        })
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .returning({ id: users.id, isActive: users.isActive });
      if (!changed) return undefined;
      await tx.insert(auditEvents).values({
        actorAdminUserId: adminUserId,
        hospitalId: adminHospitalId,
        action: 'admin.user_status_changed',
        entityType: 'user',
        entityId: userId,
        after: { isActive },
      });
      return changed;
    });

    if (!updated) throw new NotFoundException('Utilizador não encontrado.');
    return updated;
  }

  async listPendingRequests(
    adminHospitalId: string | null,
    limit: number,
    offset: number,
  ) {
    const pageSize = Math.min(Math.max(limit, 1), 100);
    const pageOffset = Math.max(offset, 0);
    const conditions = [
      eq(hospitalUser.status, 'pending'),
      isNull(hospitalUser.deletedAt),
    ];

    if (adminHospitalId) {
      conditions.push(eq(hospitalUser.hospitalId, adminHospitalId));
    }

    const rows = await this.db
      .select({
        id: hospitalUser.id,
        userId: hospitalUser.userId,
        userEmail: users.email,
        userNome: users.nome,
        hospitalId: hospitalUser.hospitalId,
        hospitalNome: hospitals.nome,
        requestedAt: hospitalUser.requestedAt,
        createdAt: hospitalUser.createdAt,
      })
      .from(hospitalUser)
      .innerJoin(users, eq(hospitalUser.userId, users.id))
      .innerJoin(hospitals, eq(hospitalUser.hospitalId, hospitals.id))
      .where(
        and(
          ...conditions,
          eq(users.isActive, true),
          isNull(users.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      )
      .limit(pageSize)
      .offset(pageOffset);

    return rows;
  }

  async approveRequest(
    adminHospitalId: string | null,
    requestId: string,
    adminUserId: string,
    action: 'approve' | 'reject',
  ) {
    const [request] = await this.db
      .select({
        id: hospitalUser.id,
        hospitalId: hospitalUser.hospitalId,
        userId: hospitalUser.userId,
        status: hospitalUser.status,
      })
      .from(hospitalUser)
      .innerJoin(users, eq(hospitalUser.userId, users.id))
      .innerJoin(hospitals, eq(hospitalUser.hospitalId, hospitals.id))
      .where(
        and(
          eq(hospitalUser.id, requestId),
          eq(users.isActive, true),
          isNull(hospitalUser.deletedAt),
          isNull(users.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      )
      .limit(1);

    if (!request) throw new NotFoundException('Pedido não encontrado.');

    if (adminHospitalId && request.hospitalId !== adminHospitalId) {
      throw new ForbiddenException('Sem permissão para gerir este pedido.');
    }

    if (request.status !== 'pending') {
      throw new BadRequestException('Pedido já processado.');
    }

    return this.db.transaction(async (tx) => {
      const [processed] = await tx
        .update(hospitalUser)
        .set(
          action === 'approve'
            ? { status: 'approved', isActive: true, approvedAt: new Date() }
            : { deletedAt: new Date() },
        )
        .where(
          and(
            eq(hospitalUser.id, requestId),
            eq(hospitalUser.status, 'pending'),
            isNull(hospitalUser.deletedAt),
          ),
        )
        .returning({ id: hospitalUser.id });
      if (!processed) {
        throw new BadRequestException('Pedido já processado.');
      }
      await tx.insert(auditEvents).values({
        actorAdminUserId: adminUserId,
        hospitalId: request.hospitalId,
        action:
          action === 'approve'
            ? 'admin.membership_approved'
            : 'admin.membership_rejected',
        entityType: 'hospital_user',
        entityId: request.id,
        after: {
          userId: request.userId,
          status: action === 'approve' ? 'approved' : 'rejected',
        },
      });
      return {
        status: action === 'approve' ? ('approved' as const) : ('rejected' as const),
      };
    });
  }
}
