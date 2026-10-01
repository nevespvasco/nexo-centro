import { Inject, Injectable } from '@nestjs/common';
import {
  funcaoCirurgiaoHospital,
  funcaoCirurgiaos,
  tipoDeAbordagemHospital,
  tipoDeAbordagens,
  tipoDeCirurgiaHospital,
  tipoDeCirurgias,
  type Database,
} from '@nexo-centro/db';
import type { CatalogoItem, CatalogosRegisto } from '@nexo-centro/schemas';
import { and, asc, eq, exists, isNull, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../database/drizzle.constants';

/** Serve os catálogos de referência que alimentam as dropdowns do registo cirúrgico. */
@Injectable()
export class CatalogosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Itens (id+nome) de um catálogo partilhável disponíveis no hospital: globais ou associados. */
  private async availableItems(
    hospitalId: string,
    itemTable: PgTable,
    item: {
      id: PgColumn;
      nome: PgColumn;
      isGlobal: PgColumn;
      deletedAt: PgColumn;
    },
    assocTable: PgTable,
    assocItemFk: PgColumn,
    assocHospitalId: PgColumn,
    assocDeletedAt: PgColumn,
  ): Promise<CatalogoItem[]> {
    const available = sql`(${item.isGlobal} = true OR ${exists(
      this.db
        .select({ one: sql`1` })
        .from(assocTable)
        .where(
          and(
            eq(assocItemFk, item.id),
            eq(assocHospitalId, hospitalId),
            isNull(assocDeletedAt),
          ),
        ),
    )})`;
    return (await this.db
      .select({ id: item.id, nome: item.nome })
      .from(itemTable)
      .where(and(isNull(item.deletedAt), available))
      .orderBy(asc(item.nome))) as CatalogoItem[];
  }

  async registo(hospitalId: string): Promise<CatalogosRegisto> {
    const [tiposDeCirurgia, funcoesCirurgiao, tiposDeAbordagem] =
      await Promise.all([
        this.availableItems(
          hospitalId,
          tipoDeCirurgias,
          tipoDeCirurgias,
          tipoDeCirurgiaHospital,
          tipoDeCirurgiaHospital.tipoDeCirurgiaId,
          tipoDeCirurgiaHospital.hospitalId,
          tipoDeCirurgiaHospital.deletedAt,
        ),
        this.availableItems(
          hospitalId,
          funcaoCirurgiaos,
          funcaoCirurgiaos,
          funcaoCirurgiaoHospital,
          funcaoCirurgiaoHospital.funcaoCirurgiaoId,
          funcaoCirurgiaoHospital.hospitalId,
          funcaoCirurgiaoHospital.deletedAt,
        ),
        this.availableItems(
          hospitalId,
          tipoDeAbordagens,
          tipoDeAbordagens,
          tipoDeAbordagemHospital,
          tipoDeAbordagemHospital.tipoDeAbordagemId,
          tipoDeAbordagemHospital.hospitalId,
          tipoDeAbordagemHospital.deletedAt,
        ),
      ]);
    return {
      tiposDeCirurgia,
      funcoesCirurgiao,
      tiposDeAbordagem,
    } satisfies CatalogosRegisto;
  }
}
