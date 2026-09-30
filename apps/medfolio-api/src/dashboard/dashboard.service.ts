import { Inject, Injectable } from '@nestjs/common';
import {
  atividadesCientificas,
  cirurgias,
  formacoes,
  registoCirurgicos,
  tipoDeCirurgias,
  utentes,
  type Database,
} from '@nexo-centro/db';
import type { Dashboard, DashboardRegistoRecente } from '@nexo-centro/schemas';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  sum,
} from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';

/** Métricas do painel clínico do utilizador autenticado no hospital ativo. */
@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async summary(hospitalId: string, userId: string): Promise<Dashboard> {
    const firstOfMonth = this.firstOfCurrentMonth();
    const registoScope = and(
      eq(registoCirurgicos.hospitalId, hospitalId),
      eq(registoCirurgicos.userId, userId),
      isNull(registoCirurgicos.deletedAt),
    );

    const [
      [registos],
      [utentesDistintos],
      [mes],
      [complic],
      [ativ],
      [form],
      [horasCred],
      recentes,
    ] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(registoCirurgicos)
        .where(registoScope),
      this.db
        .select({ value: countDistinct(registoCirurgicos.utenteId) })
        .from(registoCirurgicos)
        .where(registoScope),
      this.db
        .select({ value: count() })
        .from(registoCirurgicos)
        .where(
          and(registoScope, gte(registoCirurgicos.dataCirurgia, firstOfMonth)),
        ),
      this.db
        .select({ value: count() })
        .from(cirurgias)
        .innerJoin(
          registoCirurgicos,
          eq(cirurgias.registoCirurgicoId, registoCirurgicos.id),
        )
        .where(
          and(
            registoScope,
            isNull(cirurgias.deletedAt),
            isNotNull(cirurgias.clavienDindo),
            ne(cirurgias.clavienDindo, 'sem_complicacoes'),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(atividadesCientificas)
        .where(eq(atividadesCientificas.userId, userId)),
      this.db
        .select({ value: count() })
        .from(formacoes)
        .where(eq(formacoes.userId, userId)),
      this.db
        .select({
          horas: sum(formacoes.duracaoHoras),
          creditos: sum(formacoes.creditos),
        })
        .from(formacoes)
        .where(eq(formacoes.userId, userId)),
      this.recentes(hospitalId, userId),
    ]);

    return {
      totalRegistos: registos.value,
      totalUtentes: utentesDistintos.value,
      cirurgiasMes: mes.value,
      complicacoes: complic.value,
      totalAtividades: ativ.value,
      totalFormacoes: form.value,
      horasFormacao: Number(horasCred.horas ?? 0),
      creditosFormacao: Number(horasCred.creditos ?? 0),
      registosRecentes: recentes,
    };
  }

  private async recentes(
    hospitalId: string,
    userId: string,
  ): Promise<DashboardRegistoRecente[]> {
    const rows = await this.db
      .select({
        id: registoCirurgicos.id,
        dataCirurgia: registoCirurgicos.dataCirurgia,
        utenteNome: utentes.nome,
        utenteProcesso: utentes.processo,
        tipoDeCirurgiaNome: tipoDeCirurgias.nome,
      })
      .from(registoCirurgicos)
      .leftJoin(utentes, eq(registoCirurgicos.utenteId, utentes.id))
      .leftJoin(
        tipoDeCirurgias,
        eq(registoCirurgicos.tipoDeCirurgiaId, tipoDeCirurgias.id),
      )
      .where(
        and(
          eq(registoCirurgicos.hospitalId, hospitalId),
          eq(registoCirurgicos.userId, userId),
          isNull(registoCirurgicos.deletedAt),
        ),
      )
      .orderBy(desc(registoCirurgicos.dataCirurgia))
      .limit(5);

    if (rows.length === 0) return [];

    const counts = await this.db
      .select({
        registoCirurgicoId: cirurgias.registoCirurgicoId,
        id: cirurgias.id,
      })
      .from(cirurgias)
      .where(
        and(
          inArray(
            cirurgias.registoCirurgicoId,
            rows.map((r) => r.id),
          ),
          isNull(cirurgias.deletedAt),
        ),
      );
    const byRegisto = new Map<string, number>();
    for (const c of counts) {
      byRegisto.set(
        c.registoCirurgicoId,
        (byRegisto.get(c.registoCirurgicoId) ?? 0) + 1,
      );
    }

    return rows.map((r) => ({
      ...r,
      utenteProcesso: r.utenteProcesso ?? '',
      numeroCirurgias: byRegisto.get(r.id) ?? 0,
    }));
  }

  private firstOfCurrentMonth(): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }
}
