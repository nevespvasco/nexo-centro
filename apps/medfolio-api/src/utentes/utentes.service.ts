import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { registoCirurgicos, type Database, utentes } from '@nexo-centro/db';
import type { CreateUtente, UpdateUtente } from '@nexo-centro/schemas';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';
import { pgConstraintName, pgErrorCode } from '../common/pg-error.util';

@Injectable()
export class UtentesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(hospitalId: string) {
    return this.db
      .select()
      .from(utentes)
      .where(and(eq(utentes.hospitalId, hospitalId), isNull(utentes.deletedAt)))
      .orderBy(asc(utentes.nome));
  }

  async findOne(hospitalId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(utentes)
      .where(and(eq(utentes.id, id), eq(utentes.hospitalId, hospitalId), isNull(utentes.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Utente não encontrado.');
    }
    return row;
  }

  async create(hospitalId: string, userId: string, payload: CreateUtente) {
    try {
      const [created] = await this.db
        .insert(utentes)
        .values({ ...payload, hospitalId, createdByUserId: userId })
        .returning();
      return created;
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async update(hospitalId: string, id: string, payload: UpdateUtente) {
    await this.findOne(hospitalId, id);
    try {
      const [updated] = await this.db
        .update(utentes)
        .set(payload)
        .where(and(eq(utentes.id, id), eq(utentes.hospitalId, hospitalId)))
        .returning();
      return updated;
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async remove(hospitalId: string, id: string): Promise<void> {
    await this.findOne(hospitalId, id);
    await this.assertNotReferenced(id);
    try {
      await this.db
        .update(utentes)
        .set({ deletedAt: new Date() })
        .where(and(eq(utentes.id, id), eq(utentes.hospitalId, hospitalId)));
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
      .where(and(eq(registoCirurgicos.utenteId, id), isNull(registoCirurgicos.deletedAt)))
      .limit(1);
    if (usedByRegisto) {
      throw new BadRequestException('Não é possível eliminar: está a ser usado.');
    }
  }

  private mapWriteError(err: unknown): Error {
    const constraint = pgConstraintName(err);
    if (constraint === 'utentes_hospital_id_processo_uq') {
      return new BadRequestException('Já existe um utente com esse número de processo.');
    }
    if (pgErrorCode(err) === '23503') {
      return new BadRequestException('Não é possível eliminar: está a ser usado.');
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
