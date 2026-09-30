import { Inject, Injectable } from '@nestjs/common';
import {
  funcaoCirurgiaos,
  tipoDeAbordagens,
  tipoDeCirurgias,
  type Database,
} from '@nexo-centro/db';
import type { CatalogoItem, CatalogosRegisto } from '@nexo-centro/schemas';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';

/** Serve os catálogos de referência que alimentam as dropdowns do registo cirúrgico. */
@Injectable()
export class CatalogosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async registo(hospitalId: string): Promise<CatalogosRegisto> {
    const [tiposDeCirurgia, funcoesCirurgiao, tiposDeAbordagem] =
      await Promise.all([
        this.db
          .select({ id: tipoDeCirurgias.id, nome: tipoDeCirurgias.nome })
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
          .orderBy(asc(tipoDeCirurgias.nome)),
        this.db
          .select({ id: funcaoCirurgiaos.id, nome: funcaoCirurgiaos.nome })
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
          .orderBy(asc(funcaoCirurgiaos.nome)),
        this.db
          .select({ id: tipoDeAbordagens.id, nome: tipoDeAbordagens.nome })
          .from(tipoDeAbordagens)
          .where(
            and(
              or(
                eq(tipoDeAbordagens.hospitalId, hospitalId),
                isNull(tipoDeAbordagens.hospitalId),
              ),
              isNull(tipoDeAbordagens.deletedAt),
            ),
          )
          .orderBy(asc(tipoDeAbordagens.nome)),
      ]);
    return {
      tiposDeCirurgia: tiposDeCirurgia satisfies CatalogoItem[],
      funcoesCirurgiao,
      tiposDeAbordagem,
    };
  }
}
