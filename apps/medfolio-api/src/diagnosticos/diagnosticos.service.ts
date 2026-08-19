import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { cirurgias, diagnosticos, zonaAnatomicas, type Database } from '@nexo-centro/db';
import type { CreateDiagnostico, UpdateDiagnostico } from '@nexo-centro/schemas';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';
import { pgConstraintName, pgErrorCode } from '../common/pg-error.util';

@Injectable()
export class DiagnosticosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(hospitalId: string) {
    return this.db
      .select({
        id: diagnosticos.id,
        nome: diagnosticos.nome,
        zonaAnatomicaId: diagnosticos.zonaAnatomicaId,
        zonaAnatomicaNome: zonaAnatomicas.nome,
        tipo: diagnosticos.tipo,
        descricao: diagnosticos.descricao,
        hospitalId: diagnosticos.hospitalId,
        createdAt: diagnosticos.createdAt,
        updatedAt: diagnosticos.updatedAt,
        deletedAt: diagnosticos.deletedAt,
      })
      .from(diagnosticos)
      .leftJoin(zonaAnatomicas, eq(diagnosticos.zonaAnatomicaId, zonaAnatomicas.id))
      .where(
        and(
          or(eq(diagnosticos.hospitalId, hospitalId), isNull(diagnosticos.hospitalId)),
          isNull(diagnosticos.deletedAt),
        ),
      )
      .orderBy(asc(diagnosticos.nome));
  }

  async findOne(hospitalId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(diagnosticos)
      .where(
        and(
          eq(diagnosticos.id, id),
          or(eq(diagnosticos.hospitalId, hospitalId), isNull(diagnosticos.hospitalId)),
          isNull(diagnosticos.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException('Diagnóstico não encontrado.');
    }
    return row;
  }

  async create(hospitalId: string, payload: CreateDiagnostico) {
    try {
      const [created] = await this.db
        .insert(diagnosticos)
        .values({ ...payload, hospitalId })
        .returning();
      return created;
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async update(hospitalId: string, id: string, payload: UpdateDiagnostico) {
    await this.findOwned(hospitalId, id);
    try {
      const [updated] = await this.db
        .update(diagnosticos)
        .set(payload)
        .where(and(eq(diagnosticos.id, id), eq(diagnosticos.hospitalId, hospitalId)))
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
        .update(diagnosticos)
        .set({ deletedAt: new Date() })
        .where(and(eq(diagnosticos.id, id), eq(diagnosticos.hospitalId, hospitalId)));
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
      .where(and(eq(cirurgias.diagnosticoId, id), isNull(cirurgias.deletedAt)))
      .limit(1);
    if (usedByCirurgia) {
      throw new BadRequestException('Não é possível eliminar: está a ser usado.');
    }
  }

  /** Só linhas do próprio hospital podem ser editadas/eliminadas — as globais (hospitalId null) não. */
  private async findOwned(hospitalId: string, id: string): Promise<void> {
    const [row] = await this.db
      .select({ id: diagnosticos.id })
      .from(diagnosticos)
      .where(and(eq(diagnosticos.id, id), eq(diagnosticos.hospitalId, hospitalId), isNull(diagnosticos.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Diagnóstico não encontrado.');
    }
  }

  private mapWriteError(err: unknown): Error {
    const constraint = pgConstraintName(err);
    if (constraint === 'diagnosticos_hospital_id_nome_uq' || constraint === 'diagnosticos_nome_global_uq') {
      return new BadRequestException('Já existe um diagnóstico com esse nome.');
    }
    if (constraint === 'diagnosticos_zona_anatomica_id_zona_anatomicas_id_fk') {
      return new BadRequestException('Zona anatómica inválida.');
    }
    if (pgErrorCode(err) === '23503') {
      return new BadRequestException('Não é possível eliminar: está a ser usado.');
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
