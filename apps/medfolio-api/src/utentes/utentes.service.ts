import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  auditEvents,
  hospitals,
  registoCirurgicos,
  type Database,
  utentes,
} from '@nexo-centro/db';
import type { CreateUtente, UpdateUtente } from '@nexo-centro/schemas';
import {
  and,
  asc,
  count,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  or,
} from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';
import { pgConstraintName, pgErrorCode } from '../common/pg-error.util';

@Injectable()
export class UtentesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private multiCondition(
    hospitalIds: string[],
    userId: string,
    search?: string,
  ) {
    return and(
      inArray(utentes.hospitalId, hospitalIds),
      eq(utentes.createdByUserId, userId),
      isNull(utentes.deletedAt),
      search
        ? or(
            ilike(utentes.nome, `%${search}%`),
            ilike(utentes.processo, `%${search}%`),
          )
        : undefined,
    );
  }

  async hospitalNames(hospitalIds: string[]) {
    return this.db
      .select({ id: hospitals.id, nome: hospitals.nome })
      .from(hospitals)
      .where(inArray(hospitals.id, hospitalIds))
      .orderBy(asc(hospitals.nome));
  }

  async exportPage(
    hospitalIds: string[],
    userId: string,
    search?: string,
    afterId?: string,
  ) {
    return this.db
      .select({
        id: utentes.id,
        nome: utentes.nome,
        sexo: utentes.sexo,
        dataNascimento: utentes.dataNascimento,
        processo: utentes.processo,
        hospitalId: utentes.hospitalId,
        hospitalNome: hospitals.nome,
      })
      .from(utentes)
      .innerJoin(hospitals, eq(utentes.hospitalId, hospitals.id))
      .where(
        and(
          this.multiCondition(hospitalIds, userId, search),
          afterId ? gt(utentes.id, afterId) : undefined,
        ),
      )
      .orderBy(asc(utentes.id))
      .limit(100);
  }

  async listMulti(
    hospitalIds: string[],
    userId: string,
    limit: number,
    offset: number,
    search?: string,
  ) {
    const condition = this.multiCondition(hospitalIds, userId, search);
    const [total] = await this.db
      .select({ value: count() })
      .from(utentes)
      .where(condition);
    const rows = await this.db
      .select({
        id: utentes.id,
        nome: utentes.nome,
        sexo: utentes.sexo,
        dataNascimento: utentes.dataNascimento,
        processo: utentes.processo,
        hospitalId: utentes.hospitalId,
        hospitalNome: hospitals.nome,
        createdByUserId: utentes.createdByUserId,
        createdAt: utentes.createdAt,
        updatedAt: utentes.updatedAt,
        deletedAt: utentes.deletedAt,
      })
      .from(utentes)
      .innerJoin(hospitals, eq(utentes.hospitalId, hospitals.id))
      .where(condition)
      .orderBy(asc(utentes.nome), asc(utentes.id))
      .limit(Math.min(Math.max(limit, 1), 100))
      .offset(Math.max(offset, 0));
    return { total: total.value, rows };
  }

  async list(
    hospitalId: string,
    userId: string,
    limit: number,
    offset: number,
  ) {
    const pageSize = Math.min(Math.max(limit, 1), 100);
    const pageOffset = Math.max(offset, 0);
    return this.db
      .select()
      .from(utentes)
      .where(
        and(
          eq(utentes.hospitalId, hospitalId),
          eq(utentes.createdByUserId, userId),
          isNull(utentes.deletedAt),
        ),
      )
      .orderBy(asc(utentes.nome))
      .limit(pageSize)
      .offset(pageOffset);
  }

  async findByProcesso(hospitalId: string, userId: string, processo: string) {
    const [row] = await this.db
      .select()
      .from(utentes)
      .where(
        and(
          eq(utentes.hospitalId, hospitalId),
          eq(utentes.createdByUserId, userId),
          eq(utentes.processo, processo),
          isNull(utentes.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findOne(hospitalId: string, userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(utentes)
      .where(
        and(
          eq(utentes.id, id),
          eq(utentes.hospitalId, hospitalId),
          eq(utentes.createdByUserId, userId),
          isNull(utentes.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Utente não encontrado.');
    }
    return row;
  }

  async create(hospitalId: string, userId: string, payload: CreateUtente) {
    try {
      return await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(utentes)
          .values({ ...payload, hospitalId, createdByUserId: userId })
          .returning();
        await tx.insert(auditEvents).values({
          actorUserId: userId,
          hospitalId,
          action: 'create',
          entityType: 'utente',
          entityId: created.id,
          after: created,
        });
        return created;
      });
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async update(
    hospitalId: string,
    userId: string,
    id: string,
    payload: UpdateUtente,
  ) {
    const before = await this.findOne(hospitalId, userId, id);
    try {
      return await this.db.transaction(async (tx) => {
        const [updated] = await tx
          .update(utentes)
          .set(payload)
          .where(
            and(
              eq(utentes.id, id),
              eq(utentes.hospitalId, hospitalId),
              eq(utentes.createdByUserId, userId),
              isNull(utentes.deletedAt),
            ),
          )
          .returning();
        if (!updated) {
          throw new NotFoundException('Utente não encontrado.');
        }
        await tx.insert(auditEvents).values({
          actorUserId: userId,
          hospitalId,
          action: 'update',
          entityType: 'utente',
          entityId: id,
          before,
          after: updated,
        });
        return updated;
      });
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async remove(hospitalId: string, userId: string, id: string): Promise<void> {
    const before = await this.findOne(hospitalId, userId, id);
    await this.assertNotReferenced(id);
    try {
      await this.db.transaction(async (tx) => {
        const [removed] = await tx
          .update(utentes)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(utentes.id, id),
              eq(utentes.hospitalId, hospitalId),
              eq(utentes.createdByUserId, userId),
              isNull(utentes.deletedAt),
            ),
          )
          .returning({ id: utentes.id });
        if (!removed) {
          throw new NotFoundException('Utente não encontrado.');
        }
        await tx.insert(auditEvents).values({
          actorUserId: userId,
          hospitalId,
          action: 'delete',
          entityType: 'utente',
          entityId: id,
          before,
        });
      });
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  /**
   * A eliminação é lógica (`deletedAt`), não um `DELETE` real — o `onDelete: 'restrict'`
   * do schema nunca dispara, por isso a referência tem de ser verificada aqui.
   */
  private async assertNotReferenced(id: string): Promise<void> {
    const [usedByRegisto] = await this.db
      .select({ id: registoCirurgicos.id })
      .from(registoCirurgicos)
      .where(
        and(
          eq(registoCirurgicos.utenteId, id),
          isNull(registoCirurgicos.deletedAt),
        ),
      )
      .limit(1);
    if (usedByRegisto) {
      throw new BadRequestException(
        'Não é possível eliminar: está a ser usado.',
      );
    }
  }

  private mapWriteError(err: unknown): Error {
    const constraint = pgConstraintName(err);
    if (constraint === 'utentes_hospital_id_processo_uq') {
      return new BadRequestException(
        'Já existe um utente com esse número de processo.',
      );
    }
    if (pgErrorCode(err) === '23503') {
      return new BadRequestException(
        'Não é possível eliminar: está a ser usado.',
      );
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
