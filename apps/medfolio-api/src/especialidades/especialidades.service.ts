import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { especialidades, procedimentos, registoCirurgicos, users, type Database } from '@nexo-centro/db';
import type { CreateEspecialidade, UpdateEspecialidade } from '@nexo-centro/schemas';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';
import { pgConstraintName, pgErrorCode } from '../common/pg-error.util';

@Injectable()
export class EspecialidadesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(hospitalId: string) {
    return this.db
      .select()
      .from(especialidades)
      .where(
        and(
          or(eq(especialidades.hospitalId, hospitalId), isNull(especialidades.hospitalId)),
          isNull(especialidades.deletedAt),
        ),
      )
      .orderBy(asc(especialidades.nome));
  }

  async findOne(hospitalId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(especialidades)
      .where(
        and(
          eq(especialidades.id, id),
          or(eq(especialidades.hospitalId, hospitalId), isNull(especialidades.hospitalId)),
          isNull(especialidades.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Especialidade não encontrada.');
    }
    return row;
  }

  async create(hospitalId: string, payload: CreateEspecialidade) {
    try {
      const [created] = await this.db
        .insert(especialidades)
        .values({ ...payload, hospitalId })
        .returning();
      return created;
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async update(hospitalId: string, id: string, payload: UpdateEspecialidade) {
    await this.findOwned(hospitalId, id);
    try {
      const [updated] = await this.db
        .update(especialidades)
        .set(payload)
        .where(and(eq(especialidades.id, id), eq(especialidades.hospitalId, hospitalId)))
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
        .update(especialidades)
        .set({ deletedAt: new Date() })
        .where(and(eq(especialidades.id, id), eq(especialidades.hospitalId, hospitalId)));
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  /**
   * A eliminação é lógica (`deletedAt`), não um `DELETE` real — o `onDelete: 'restrict'`
   * do schema nunca dispara, por isso a referência tem de ser verificada aqui.
   */
  private async assertNotReferenced(id: string): Promise<void> {
    const [[usedByProcedimento], [usedByUser], [usedByRegisto]] = await Promise.all([
      this.db
        .select({ id: procedimentos.id })
        .from(procedimentos)
        .where(and(eq(procedimentos.especialidadeId, id), isNull(procedimentos.deletedAt)))
        .limit(1),
      this.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.especialidadeId, id), isNull(users.deletedAt)))
        .limit(1),
      this.db
        .select({ id: registoCirurgicos.id })
        .from(registoCirurgicos)
        .where(and(eq(registoCirurgicos.especialidadeId, id), isNull(registoCirurgicos.deletedAt)))
        .limit(1),
    ]);
    if (usedByProcedimento || usedByUser || usedByRegisto) {
      throw new BadRequestException('Não é possível eliminar: está a ser usado.');
    }
  }

  /** Só linhas do próprio hospital podem ser editadas/eliminadas — as globais (hospitalId null) não. */
  private async findOwned(hospitalId: string, id: string): Promise<void> {
    const [row] = await this.db
      .select({ id: especialidades.id })
      .from(especialidades)
      .where(
        and(eq(especialidades.id, id), eq(especialidades.hospitalId, hospitalId), isNull(especialidades.deletedAt)),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Especialidade não encontrada.');
    }
  }

  private mapWriteError(err: unknown): Error {
    const constraint = pgConstraintName(err);
    if (constraint === 'especialidades_hospital_id_nome_uq' || constraint === 'especialidades_nome_global_uq') {
      return new BadRequestException('Já existe uma especialidade com esse nome.');
    }
    if (pgErrorCode(err) === '23503') {
      return new BadRequestException('Não é possível eliminar: está a ser usado.');
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
