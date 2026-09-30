import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  tipoDeCirurgias,
  registoCirurgicos,
  type Database,
} from '@nexo-centro/db';
import type {
  CreateCatalogoItem,
  UpdateCatalogoItem,
} from '@nexo-centro/schemas';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';
import { pgConstraintName, pgErrorCode } from '../common/pg-error.util';

@Injectable()
export class TiposDeCirurgiaService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(hospitalId: string) {
    return this.db
      .select()
      .from(tipoDeCirurgias)
      .where(
        and(
          or(
            eq(tipoDeCirurgias.hospitalId, hospitalId),
            isNull(tipoDeCirurgias.hospitalId),
          ),
          isNull(tipoDeCirurgias.deletedAt),
        ),
      )
      .orderBy(asc(tipoDeCirurgias.nome));
  }

  async findOne(hospitalId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(tipoDeCirurgias)
      .where(
        and(
          eq(tipoDeCirurgias.id, id),
          or(
            eq(tipoDeCirurgias.hospitalId, hospitalId),
            isNull(tipoDeCirurgias.hospitalId),
          ),
          isNull(tipoDeCirurgias.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Tipo de cirurgia não encontrado.');
    }
    return row;
  }

  async create(hospitalId: string, payload: CreateCatalogoItem) {
    try {
      const [created] = await this.db
        .insert(tipoDeCirurgias)
        .values({ ...payload, hospitalId })
        .returning();
      return created;
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async update(hospitalId: string, id: string, payload: UpdateCatalogoItem) {
    await this.findOwned(hospitalId, id);
    try {
      const [updated] = await this.db
        .update(tipoDeCirurgias)
        .set(payload)
        .where(
          and(
            eq(tipoDeCirurgias.id, id),
            eq(tipoDeCirurgias.hospitalId, hospitalId),
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
        .update(tipoDeCirurgias)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(tipoDeCirurgias.id, id),
            eq(tipoDeCirurgias.hospitalId, hospitalId),
          ),
        );
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  private async assertNotReferenced(id: string): Promise<void> {
    const [used] = await this.db
      .select({ id: registoCirurgicos.id })
      .from(registoCirurgicos)
      .where(
        and(
          eq(registoCirurgicos.tipoDeCirurgiaId, id),
          isNull(registoCirurgicos.deletedAt),
        ),
      )
      .limit(1);
    if (used) {
      throw new BadRequestException(
        'Não é possível eliminar: está a ser usado.',
      );
    }
  }

  private async findOwned(hospitalId: string, id: string): Promise<void> {
    const [row] = await this.db
      .select({ id: tipoDeCirurgias.id })
      .from(tipoDeCirurgias)
      .where(
        and(
          eq(tipoDeCirurgias.id, id),
          eq(tipoDeCirurgias.hospitalId, hospitalId),
          isNull(tipoDeCirurgias.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Tipo de cirurgia não encontrado.');
    }
  }

  private mapWriteError(err: unknown): Error {
    const constraint = pgConstraintName(err);
    if (
      constraint === 'tipo_de_cirurgias_hospital_id_nome_uq' ||
      constraint === 'tipo_de_cirurgias_nome_global_uq'
    ) {
      return new BadRequestException(
        'Já existe um tipo de cirurgia com esse nome.',
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
