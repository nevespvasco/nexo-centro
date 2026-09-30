import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { auditEvents, hospitals, type Database } from '@nexo-centro/db';
import type { CreateHospital, UpdateHospital } from '@nexo-centro/schemas';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { pgConstraintName } from '../common/pg-error.util';
import { DRIZZLE } from '../database/drizzle.constants';

@Injectable()
export class AdminHospitalsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listHospitals(adminHospitalId: string | null) {
    this.assertSuperAdmin(adminHospitalId);
    return this.db
      .select({
        id: hospitals.id,
        nome: hospitals.nome,
        createdAt: hospitals.createdAt,
      })
      .from(hospitals)
      .where(isNull(hospitals.deletedAt))
      .orderBy(asc(hospitals.nome));
  }

  async create(
    adminHospitalId: string | null,
    payload: CreateHospital,
    adminUserId: string,
  ) {
    this.assertSuperAdmin(adminHospitalId);
    try {
      return await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(hospitals)
          .values({ nome: payload.nome })
          .returning({
            id: hospitals.id,
            nome: hospitals.nome,
            createdAt: hospitals.createdAt,
          });
        await tx.insert(auditEvents).values({
          actorAdminUserId: adminUserId,
          hospitalId: created.id,
          action: 'admin.hospital_created',
          entityType: 'hospital',
          entityId: created.id,
          after: { nome: created.nome },
        });
        return created;
      });
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async update(
    adminHospitalId: string | null,
    id: string,
    payload: UpdateHospital,
    adminUserId: string,
  ) {
    this.assertSuperAdmin(adminHospitalId);
    await this.findExisting(id);
    try {
      return await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(hospitals)
          .set(payload)
          .where(and(eq(hospitals.id, id), isNull(hospitals.deletedAt)))
          .returning({
            id: hospitals.id,
            nome: hospitals.nome,
            createdAt: hospitals.createdAt,
          });
        await tx.insert(auditEvents).values({
          actorAdminUserId: adminUserId,
          hospitalId: id,
          action: 'admin.hospital_updated',
          entityType: 'hospital',
          entityId: id,
          after: { nome: updated.nome },
        });
        return updated;
      });
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  private assertSuperAdmin(adminHospitalId: string | null): void {
    if (adminHospitalId !== null) {
      throw new ForbiddenException(
        'Apenas super-administradores podem gerir hospitais.',
      );
    }
  }

  private async findExisting(id: string): Promise<void> {
    const [row] = await this.db
      .select({ id: hospitals.id })
      .from(hospitals)
      .where(and(eq(hospitals.id, id), isNull(hospitals.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Hospital não encontrado.');
    }
  }

  private mapWriteError(err: unknown): Error {
    if (pgConstraintName(err) === 'hospitals_nome_uq') {
      return new BadRequestException('Já existe um hospital com esse nome.');
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
