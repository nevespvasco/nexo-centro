import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { diagnosticos, zonaAnatomicas, type Database } from '@nexo-centro/db';
import type {
  CreateZonaAnatomica,
  ReorderZonasAnatomicas,
  UpdateZonaAnatomica,
} from '@nexo-centro/schemas';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';
import { pgConstraintName, pgErrorCode } from '../common/pg-error.util';

@Injectable()
export class ZonasAnatomicasService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(hospitalId: string) {
    return this.db
      .select()
      .from(zonaAnatomicas)
      .where(
        and(
          or(
            eq(zonaAnatomicas.hospitalId, hospitalId),
            isNull(zonaAnatomicas.hospitalId),
          ),
          isNull(zonaAnatomicas.deletedAt),
        ),
      )
      .orderBy(asc(zonaAnatomicas.ordem), asc(zonaAnatomicas.nome));
  }

  async findOne(hospitalId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(zonaAnatomicas)
      .where(
        and(
          eq(zonaAnatomicas.id, id),
          or(
            eq(zonaAnatomicas.hospitalId, hospitalId),
            isNull(zonaAnatomicas.hospitalId),
          ),
          isNull(zonaAnatomicas.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Zona anatómica não encontrada.');
    }
    return row;
  }

  async create(hospitalId: string, payload: CreateZonaAnatomica) {
    try {
      const [created] = await this.db
        .insert(zonaAnatomicas)
        .values({ ...payload, hospitalId })
        .returning();
      return created;
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async update(hospitalId: string, id: string, payload: UpdateZonaAnatomica) {
    await this.findOwned(hospitalId, id);
    try {
      const [updated] = await this.db
        .update(zonaAnatomicas)
        .set(payload)
        .where(
          and(
            eq(zonaAnatomicas.id, id),
            eq(zonaAnatomicas.hospitalId, hospitalId),
          ),
        )
        .returning();
      return updated;
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async remove(hospitalId: string, id: string): Promise<void> {
    await this.findOwned(hospitalId, id);
    await this.assertNotReferenced(id);
    try {
      await this.db
        .update(zonaAnatomicas)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(zonaAnatomicas.id, id),
            eq(zonaAnatomicas.hospitalId, hospitalId),
          ),
        );
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async reorder(hospitalId: string, items: ReorderZonasAnatomicas): Promise<void> {
    if (items.length === 0) return;
    await this.db.transaction(async (tx) => {
      for (const { id, ordem } of items) {
        await tx
          .update(zonaAnatomicas)
          .set({ ordem })
          .where(
            and(
              eq(zonaAnatomicas.id, id),
              eq(zonaAnatomicas.hospitalId, hospitalId),
              isNull(zonaAnatomicas.deletedAt),
            ),
          );
      }
    });
  }

  /**
   * A eliminação é lógica (`deletedAt`), não um `DELETE` real — o `onDelete: 'restrict'`
   * do schema nunca dispara, por isso a referência tem de ser verificada aqui.
   */
  private async assertNotReferenced(id: string): Promise<void> {
    const [usedByDiagnostico] = await this.db
      .select({ id: diagnosticos.id })
      .from(diagnosticos)
      .where(
        and(
          eq(diagnosticos.zonaAnatomicaId, id),
          isNull(diagnosticos.deletedAt),
        ),
      )
      .limit(1);
    if (usedByDiagnostico) {
      throw new BadRequestException(
        'Não é possível eliminar: está a ser usado.',
      );
    }
  }

  /** Só linhas do próprio hospital podem ser editadas/eliminadas — as globais (hospitalId null) não. */
  private async findOwned(hospitalId: string, id: string): Promise<void> {
    const [row] = await this.db
      .select({ id: zonaAnatomicas.id })
      .from(zonaAnatomicas)
      .where(
        and(
          eq(zonaAnatomicas.id, id),
          eq(zonaAnatomicas.hospitalId, hospitalId),
          isNull(zonaAnatomicas.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Zona anatómica não encontrada.');
    }
  }

  private mapWriteError(err: unknown): Error {
    const constraint = pgConstraintName(err);
    if (
      constraint === 'zona_anatomicas_hospital_id_nome_uq' ||
      constraint === 'zona_anatomicas_nome_global_uq'
    ) {
      return new BadRequestException(
        'Já existe uma zona anatómica com esse nome.',
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
