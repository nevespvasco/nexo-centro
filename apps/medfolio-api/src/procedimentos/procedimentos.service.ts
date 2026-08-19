import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { cirurgias, especialidades, procedimentos, type Database } from '@nexo-centro/db';
import type { CreateProcedimento, UpdateProcedimento } from '@nexo-centro/schemas';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';
import { pgConstraintName, pgErrorCode } from '../common/pg-error.util';

@Injectable()
export class ProcedimentosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(hospitalId: string) {
    return this.db
      .select({
        id: procedimentos.id,
        nome: procedimentos.nome,
        especialidadeId: procedimentos.especialidadeId,
        especialidadeNome: especialidades.nome,
        descricao: procedimentos.descricao,
        hospitalId: procedimentos.hospitalId,
        createdAt: procedimentos.createdAt,
        updatedAt: procedimentos.updatedAt,
        deletedAt: procedimentos.deletedAt,
      })
      .from(procedimentos)
      .leftJoin(especialidades, eq(procedimentos.especialidadeId, especialidades.id))
      .where(
        and(
          or(eq(procedimentos.hospitalId, hospitalId), isNull(procedimentos.hospitalId)),
          isNull(procedimentos.deletedAt),
        ),
      )
      .orderBy(asc(procedimentos.nome));
  }

  async findOne(hospitalId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(procedimentos)
      .where(
        and(
          eq(procedimentos.id, id),
          or(eq(procedimentos.hospitalId, hospitalId), isNull(procedimentos.hospitalId)),
          isNull(procedimentos.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Procedimento não encontrado.');
    }
    return row;
  }

  async create(hospitalId: string, payload: CreateProcedimento) {
    try {
      const [created] = await this.db
        .insert(procedimentos)
        .values({ ...payload, hospitalId })
        .returning();
      return created;
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async update(hospitalId: string, id: string, payload: UpdateProcedimento) {
    await this.findOwned(hospitalId, id);
    try {
      const [updated] = await this.db
        .update(procedimentos)
        .set(payload)
        .where(and(eq(procedimentos.id, id), eq(procedimentos.hospitalId, hospitalId)))
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
        .update(procedimentos)
        .set({ deletedAt: new Date() })
        .where(and(eq(procedimentos.id, id), eq(procedimentos.hospitalId, hospitalId)));
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  /**
   * A eliminação é lógica (`deletedAt`), não um `DELETE` real — o `onDelete: 'restrict'`
   * do schema nunca dispara, por isso a referência tem de ser verificada aqui.
   */
  private async assertNotReferenced(id: string): Promise<void> {
    const [usedByCirurgia] = await this.db
      .select({ id: cirurgias.id })
      .from(cirurgias)
      .where(and(eq(cirurgias.procedimentoId, id), isNull(cirurgias.deletedAt)))
      .limit(1);
    if (usedByCirurgia) {
      throw new BadRequestException('Não é possível eliminar: está a ser usado.');
    }
  }

  /** Só linhas do próprio hospital podem ser editadas/eliminadas — as globais (hospitalId null) não. */
  private async findOwned(hospitalId: string, id: string): Promise<void> {
    const [row] = await this.db
      .select({ id: procedimentos.id })
      .from(procedimentos)
      .where(and(eq(procedimentos.id, id), eq(procedimentos.hospitalId, hospitalId), isNull(procedimentos.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Procedimento não encontrado.');
    }
  }

  private mapWriteError(err: unknown): Error {
    const constraint = pgConstraintName(err);
    if (constraint === 'procedimentos_hospital_id_nome_uq' || constraint === 'procedimentos_nome_global_uq') {
      return new BadRequestException('Já existe um procedimento com esse nome.');
    }
    if (constraint === 'procedimentos_especialidade_id_especialidades_id_fk') {
      return new BadRequestException('Especialidade inválida.');
    }
    if (pgErrorCode(err) === '23503') {
      return new BadRequestException('Não é possível eliminar: está a ser usado.');
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
