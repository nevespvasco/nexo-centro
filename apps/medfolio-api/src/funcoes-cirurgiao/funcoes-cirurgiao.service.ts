import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { funcaoCirurgiaos, cirurgias, type Database } from '@nexo-centro/db';
import type {
  CreateCatalogoItem,
  UpdateCatalogoItem,
} from '@nexo-centro/schemas';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';
import { pgConstraintName, pgErrorCode } from '../common/pg-error.util';

@Injectable()
export class FuncoesCirurgiaoService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(hospitalId: string) {
    return this.db
      .select()
      .from(funcaoCirurgiaos)
      .where(
        and(
          or(
            eq(funcaoCirurgiaos.hospitalId, hospitalId),
            isNull(funcaoCirurgiaos.hospitalId),
          ),
          isNull(funcaoCirurgiaos.deletedAt),
        ),
      )
      .orderBy(asc(funcaoCirurgiaos.nome));
  }

  async findOne(hospitalId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(funcaoCirurgiaos)
      .where(
        and(
          eq(funcaoCirurgiaos.id, id),
          or(
            eq(funcaoCirurgiaos.hospitalId, hospitalId),
            isNull(funcaoCirurgiaos.hospitalId),
          ),
          isNull(funcaoCirurgiaos.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Função do cirurgião não encontrada.');
    }
    return row;
  }

  async create(hospitalId: string, payload: CreateCatalogoItem) {
    try {
      const [created] = await this.db
        .insert(funcaoCirurgiaos)
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
        .update(funcaoCirurgiaos)
        .set(payload)
        .where(
          and(
            eq(funcaoCirurgiaos.id, id),
            eq(funcaoCirurgiaos.hospitalId, hospitalId),
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
        .update(funcaoCirurgiaos)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(funcaoCirurgiaos.id, id),
            eq(funcaoCirurgiaos.hospitalId, hospitalId),
          ),
        );
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  private async assertNotReferenced(id: string): Promise<void> {
    const [used] = await this.db
      .select({ id: cirurgias.id })
      .from(cirurgias)
      .where(
        and(eq(cirurgias.funcaoCirurgiaoId, id), isNull(cirurgias.deletedAt)),
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
      .select({ id: funcaoCirurgiaos.id })
      .from(funcaoCirurgiaos)
      .where(
        and(
          eq(funcaoCirurgiaos.id, id),
          eq(funcaoCirurgiaos.hospitalId, hospitalId),
          isNull(funcaoCirurgiaos.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Função do cirurgião não encontrada.');
    }
  }

  private mapWriteError(err: unknown): Error {
    const constraint = pgConstraintName(err);
    if (
      constraint === 'funcao_cirurgiaos_hospital_id_nome_uq' ||
      constraint === 'funcao_cirurgiaos_nome_global_uq'
    ) {
      return new BadRequestException(
        'Já existe uma função de cirurgião com esse nome.',
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
