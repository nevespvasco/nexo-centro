import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  auditEvents,
  cirurgias,
  diagnosticos,
  especialidadeHospital,
  especialidades,
  funcaoCirurgiaoHospital,
  funcaoCirurgiaos,
  hospitals,
  procedimentoHospital,
  procedimentos,
  registoCirurgicos,
  tipoDeAbordagemHospital,
  tipoDeAbordagens,
  tipoDeCirurgiaHospital,
  tipoDeCirurgias,
  utentes,
  type Database,
} from '@nexo-centro/db';
import type {
  CirurgiaDetalhe,
  CreateRegisto,
  RegistoDetalhe,
  RegistoFiltros,
  RegistoResumo,
  UpdateRegisto,
} from '@nexo-centro/schemas';
import {
  SQL,
  and,
  asc,
  count,
  countDistinct,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';

/**
 * Registo cirúrgico: agregado hospital+utilizador com uma ou mais cirurgias
 * (detalhe). Cada query filtra por `hospitalId` E `userId` — o scope de hospital
 * sozinho ainda deixaria ver registos de outros utilizadores no mesmo hospital.
 *
 * As referências (utente, catálogos, diagnósticos…) são validadas contra o
 * hospital ativo antes de escrever, para fechar o IDOR cross-tenant descrito em
 * docs/MedTrack (SEC-02): a FK garante que o id existe algalgures, não que
 * pertence a este hospital.
 */
@Injectable()
export class RegistosCirurgicosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  private multiConditions(
    hospitalIds: string[],
    userId: string,
    filtros: RegistoFiltros,
  ) {
    const conditions: SQL[] = [
      inArray(registoCirurgicos.hospitalId, hospitalIds),
      eq(registoCirurgicos.userId, userId),
      isNull(registoCirurgicos.deletedAt),
    ];
    if (filtros.search)
      conditions.push(
        or(
          ilike(utentes.nome, `%${filtros.search}%`),
          ilike(utentes.processo, `%${filtros.search}%`),
        )!,
      );
    if (filtros.dataInicio)
      conditions.push(gte(registoCirurgicos.dataCirurgia, filtros.dataInicio));
    if (filtros.dataFim)
      conditions.push(lte(registoCirurgicos.dataCirurgia, filtros.dataFim));
    if (filtros.tipoDeCirurgiaIds?.length)
      conditions.push(
        inArray(registoCirurgicos.tipoDeCirurgiaId, filtros.tipoDeCirurgiaIds),
      );
    for (const [key, column] of [
      [filtros.diagnosticoId, cirurgias.diagnosticoId],
      [filtros.procedimentoId, cirurgias.procedimentoId],
      [filtros.funcaoCirurgiaoId, cirurgias.funcaoCirurgiaoId],
    ] as const) {
      if (key)
        conditions.push(
          exists(
            this.db
              .select({ id: cirurgias.id })
              .from(cirurgias)
              .where(
                and(
                  eq(cirurgias.registoCirurgicoId, registoCirurgicos.id),
                  eq(column, key),
                  isNull(cirurgias.deletedAt),
                ),
              ),
          ),
        );
    }
    return and(...conditions)!;
  }

  async listMulti(
    hospitalIds: string[],
    userId: string,
    limit: number,
    offset: number,
    filtros: RegistoFiltros,
    options?: { cursor?: { data: string; id: string }; includeTotal?: boolean },
  ) {
    const scope = this.multiConditions(hospitalIds, userId, filtros);
    const [totalRow] =
      options?.includeTotal === false
        ? [{ value: 0 }]
        : await this.db
            .select({ value: count() })
            .from(registoCirurgicos)
            .leftJoin(utentes, eq(registoCirurgicos.utenteId, utentes.id))
            .where(scope);
    const cursor = options?.cursor;
    const pageScope = cursor
      ? and(
          scope,
          or(
            lt(registoCirurgicos.dataCirurgia, cursor.data),
            and(
              eq(registoCirurgicos.dataCirurgia, cursor.data),
              lt(registoCirurgicos.id, cursor.id),
            ),
          ),
        )
      : scope;
    const rows = await this.db
      .select({
        id: registoCirurgicos.id,
        hospitalId: registoCirurgicos.hospitalId,
        hospitalNome: hospitals.nome,
        utenteNome: utentes.nome,
        utenteProcesso: utentes.processo,
        utenteSexo: utentes.sexo,
        especialidadeNome: especialidades.nome,
        dataCirurgia: registoCirurgicos.dataCirurgia,
        idadeCirurgia: registoCirurgicos.idadeCirurgia,
        observacoes: registoCirurgicos.observacoes,
        tipoDeCirurgiaNome: tipoDeCirurgias.nome,
        tipoDeAbordagemNome: tipoDeAbordagens.nome,
        ambulatorio: registoCirurgicos.ambulatorio,
      })
      .from(registoCirurgicos)
      .innerJoin(hospitals, eq(registoCirurgicos.hospitalId, hospitals.id))
      .leftJoin(utentes, eq(registoCirurgicos.utenteId, utentes.id))
      .leftJoin(
        especialidades,
        eq(registoCirurgicos.especialidadeId, especialidades.id),
      )
      .leftJoin(
        tipoDeCirurgias,
        eq(registoCirurgicos.tipoDeCirurgiaId, tipoDeCirurgias.id),
      )
      .leftJoin(
        tipoDeAbordagens,
        eq(registoCirurgicos.tipoDeAbordagemId, tipoDeAbordagens.id),
      )
      .where(pageScope)
      .orderBy(desc(registoCirurgicos.dataCirurgia), desc(registoCirurgicos.id))
      .limit(Math.min(Math.max(limit, 1), 100))
      .offset(Math.max(offset, 0));
    const counts = rows.length
      ? await this.db
          .select({ registoId: cirurgias.registoCirurgicoId, value: count() })
          .from(cirurgias)
          .where(
            and(
              inArray(
                cirurgias.registoCirurgicoId,
                rows.map((r) => r.id),
              ),
              isNull(cirurgias.deletedAt),
            ),
          )
          .groupBy(cirurgias.registoCirurgicoId)
      : [];
    const byId = new Map(counts.map((r) => [r.registoId, r.value]));
    return {
      total: totalRow.value,
      rows: rows.map((r) => ({
        ...r,
        utenteProcesso: r.utenteProcesso ?? '',
        numeroCirurgias: byId.get(r.id) ?? 0,
      })),
    };
  }

  async statistics(
    hospitalIds: string[],
    userId: string,
    filtros: RegistoFiltros,
  ) {
    const scope = this.multiConditions(hospitalIds, userId, filtros);
    const names = await this.db
      .select({ id: hospitals.id, nome: hospitals.nome })
      .from(hospitals)
      .where(inArray(hospitals.id, hospitalIds))
      .orderBy(asc(hospitals.nome));
    const counted = await this.db
      .select({
        hospitalId: hospitals.id,
        hospitalNome: hospitals.nome,
        registos: countDistinct(registoCirurgicos.id),
        cirurgias: count(cirurgias.id),
      })
      .from(registoCirurgicos)
      .innerJoin(hospitals, eq(registoCirurgicos.hospitalId, hospitals.id))
      .leftJoin(utentes, eq(registoCirurgicos.utenteId, utentes.id))
      .leftJoin(
        cirurgias,
        and(
          eq(cirurgias.registoCirurgicoId, registoCirurgicos.id),
          isNull(cirurgias.deletedAt),
        ),
      )
      .where(scope)
      .groupBy(hospitals.id, hospitals.nome)
      .orderBy(asc(hospitals.nome));
    const countByHospital = new Map(
      counted.map((row) => [row.hospitalId, row]),
    );
    const perHospital = names.map(
      (hospital) =>
        countByHospital.get(hospital.id) ?? {
          hospitalId: hospital.id,
          hospitalNome: hospital.nome,
          registos: 0,
          cirurgias: 0,
        },
    );
    const month = sql<string>`to_char(${registoCirurgicos.dataCirurgia}, 'YYYY-MM')`;
    const evolution = await this.db
      .select({ month, registos: count() })
      .from(registoCirurgicos)
      .leftJoin(utentes, eq(registoCirurgicos.utenteId, utentes.id))
      .where(scope)
      .groupBy(month)
      .orderBy(month);
    return {
      totalRegistos: perHospital.reduce((n, h) => n + h.registos, 0),
      totalCirurgias: perHospital.reduce((n, h) => n + h.cirurgias, 0),
      perHospital,
      evolution,
    };
  }

  async exportSurgeryLabels(
    hospitalIds: string[],
    userId: string,
    registoIds: string[],
  ) {
    if (!registoIds.length) return new Map<string, string[]>();
    const rows = await this.db
      .select({
        registoId: cirurgias.registoCirurgicoId,
        diagnostico: diagnosticos.nome,
        procedimento: procedimentos.nome,
        funcao: funcaoCirurgiaos.nome,
      })
      .from(cirurgias)
      .innerJoin(
        registoCirurgicos,
        eq(cirurgias.registoCirurgicoId, registoCirurgicos.id),
      )
      .leftJoin(diagnosticos, eq(cirurgias.diagnosticoId, diagnosticos.id))
      .leftJoin(procedimentos, eq(cirurgias.procedimentoId, procedimentos.id))
      .leftJoin(
        funcaoCirurgiaos,
        eq(cirurgias.funcaoCirurgiaoId, funcaoCirurgiaos.id),
      )
      .where(
        and(
          inArray(cirurgias.registoCirurgicoId, registoIds),
          inArray(registoCirurgicos.hospitalId, hospitalIds),
          eq(registoCirurgicos.userId, userId),
          isNull(cirurgias.deletedAt),
          isNull(registoCirurgicos.deletedAt),
        ),
      );
    const labels = new Map<string, string[]>();
    for (const row of rows) {
      const values = labels.get(row.registoId) ?? [];
      values.push(
        `${row.diagnostico ?? 'N/A'} — ${row.procedimento ?? 'N/A'} (${row.funcao ?? 'N/A'})`,
      );
      labels.set(row.registoId, values);
    }
    return labels;
  }

  async list(
    hospitalId: string,
    userId: string,
    limit: number,
    offset: number,
    filtros?: RegistoFiltros,
  ): Promise<RegistoResumo[]> {
    const pageSize = Math.min(Math.max(limit, 1), 100);
    const pageOffset = Math.max(offset, 0);

    const conditions: (SQL | undefined)[] = [
      eq(registoCirurgicos.hospitalId, hospitalId),
      eq(registoCirurgicos.userId, userId),
      isNull(registoCirurgicos.deletedAt),
    ];

    if (filtros?.search) {
      const term = `%${filtros.search}%`;
      conditions.push(
        or(ilike(utentes.nome, term), ilike(utentes.processo, term)),
      );
    }
    if (filtros?.dataInicio) {
      conditions.push(gte(registoCirurgicos.dataCirurgia, filtros.dataInicio));
    }
    if (filtros?.dataFim) {
      conditions.push(lte(registoCirurgicos.dataCirurgia, filtros.dataFim));
    }
    if (filtros?.tipoDeCirurgiaIds?.length) {
      conditions.push(
        inArray(registoCirurgicos.tipoDeCirurgiaId, filtros.tipoDeCirurgiaIds),
      );
    }
    if (filtros?.diagnosticoId) {
      conditions.push(
        exists(
          this.db
            .select({ id: cirurgias.id })
            .from(cirurgias)
            .where(
              and(
                eq(cirurgias.registoCirurgicoId, registoCirurgicos.id),
                eq(cirurgias.diagnosticoId, filtros.diagnosticoId),
                isNull(cirurgias.deletedAt),
              ),
            ),
        ),
      );
    }
    if (filtros?.procedimentoId) {
      conditions.push(
        exists(
          this.db
            .select({ id: cirurgias.id })
            .from(cirurgias)
            .where(
              and(
                eq(cirurgias.registoCirurgicoId, registoCirurgicos.id),
                eq(cirurgias.procedimentoId, filtros.procedimentoId),
                isNull(cirurgias.deletedAt),
              ),
            ),
        ),
      );
    }
    if (filtros?.funcaoCirurgiaoId) {
      conditions.push(
        exists(
          this.db
            .select({ id: cirurgias.id })
            .from(cirurgias)
            .where(
              and(
                eq(cirurgias.registoCirurgicoId, registoCirurgicos.id),
                eq(cirurgias.funcaoCirurgiaoId, filtros.funcaoCirurgiaoId),
                isNull(cirurgias.deletedAt),
              ),
            ),
        ),
      );
    }

    const rows = await this.db
      .select({
        id: registoCirurgicos.id,
        utenteNome: utentes.nome,
        utenteProcesso: utentes.processo,
        especialidadeNome: especialidades.nome,
        dataCirurgia: registoCirurgicos.dataCirurgia,
        tipoDeCirurgiaNome: tipoDeCirurgias.nome,
        tipoDeAbordagemNome: tipoDeAbordagens.nome,
        ambulatorio: registoCirurgicos.ambulatorio,
      })
      .from(registoCirurgicos)
      .leftJoin(utentes, eq(registoCirurgicos.utenteId, utentes.id))
      .leftJoin(
        especialidades,
        eq(registoCirurgicos.especialidadeId, especialidades.id),
      )
      .leftJoin(
        tipoDeCirurgias,
        eq(registoCirurgicos.tipoDeCirurgiaId, tipoDeCirurgias.id),
      )
      .leftJoin(
        tipoDeAbordagens,
        eq(registoCirurgicos.tipoDeAbordagemId, tipoDeAbordagens.id),
      )
      .where(and(...conditions))
      .orderBy(desc(registoCirurgicos.dataCirurgia))
      .limit(pageSize)
      .offset(pageOffset);

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
    const countByRegisto = new Map<string, number>();
    for (const c of counts) {
      countByRegisto.set(
        c.registoCirurgicoId,
        (countByRegisto.get(c.registoCirurgicoId) ?? 0) + 1,
      );
    }

    return rows.map((r) => ({
      ...r,
      utenteProcesso: r.utenteProcesso ?? '',
      numeroCirurgias: countByRegisto.get(r.id) ?? 0,
    }));
  }

  async findOne(
    hospitalId: string,
    userId: string,
    id: string,
  ): Promise<RegistoDetalhe> {
    const [registo] = await this.db
      .select({
        id: registoCirurgicos.id,
        hospitalId: registoCirurgicos.hospitalId,
        userId: registoCirurgicos.userId,
        utenteId: registoCirurgicos.utenteId,
        utenteNome: utentes.nome,
        utenteProcesso: utentes.processo,
        especialidadeId: registoCirurgicos.especialidadeId,
        especialidadeNome: especialidades.nome,
        dataCirurgia: registoCirurgicos.dataCirurgia,
        idadeCirurgia: registoCirurgicos.idadeCirurgia,
        tipoDeCirurgiaId: registoCirurgicos.tipoDeCirurgiaId,
        tipoDeCirurgiaNome: tipoDeCirurgias.nome,
        tipoDeAbordagemId: registoCirurgicos.tipoDeAbordagemId,
        tipoDeAbordagemNome: tipoDeAbordagens.nome,
        ambulatorio: registoCirurgicos.ambulatorio,
        observacoes: registoCirurgicos.observacoes,
        createdAt: registoCirurgicos.createdAt,
        updatedAt: registoCirurgicos.updatedAt,
      })
      .from(registoCirurgicos)
      .leftJoin(utentes, eq(registoCirurgicos.utenteId, utentes.id))
      .leftJoin(
        especialidades,
        eq(registoCirurgicos.especialidadeId, especialidades.id),
      )
      .leftJoin(
        tipoDeCirurgias,
        eq(registoCirurgicos.tipoDeCirurgiaId, tipoDeCirurgias.id),
      )
      .leftJoin(
        tipoDeAbordagens,
        eq(registoCirurgicos.tipoDeAbordagemId, tipoDeAbordagens.id),
      )
      .where(
        and(
          eq(registoCirurgicos.id, id),
          eq(registoCirurgicos.hospitalId, hospitalId),
          eq(registoCirurgicos.userId, userId),
          isNull(registoCirurgicos.deletedAt),
        ),
      )
      .limit(1);
    if (!registo) {
      throw new NotFoundException('Registo cirúrgico não encontrado.');
    }

    const linhas = await this.loadCirurgias(id);
    return {
      ...registo,
      utenteProcesso: registo.utenteProcesso ?? '',
      cirurgias: linhas,
    };
  }

  async create(
    hospitalId: string,
    userId: string,
    payload: CreateRegisto,
  ): Promise<RegistoDetalhe> {
    await this.assertRefs(hospitalId, userId, payload);
    const id = await this.db.transaction(async (tx) => {
      const [registo] = await tx
        .insert(registoCirurgicos)
        .values({
          hospitalId,
          userId,
          utenteId: payload.utenteId,
          especialidadeId: payload.especialidadeId,
          dataCirurgia: payload.dataCirurgia,
          idadeCirurgia: payload.idadeCirurgia,
          tipoDeCirurgiaId: payload.tipoDeCirurgiaId,
          tipoDeAbordagemId: payload.tipoDeAbordagemId,
          ambulatorio: payload.ambulatorio,
          observacoes: payload.observacoes,
        })
        .returning({ id: registoCirurgicos.id });
      await tx.insert(cirurgias).values(
        payload.cirurgias.map((c) => ({
          registoCirurgicoId: registo.id,
          diagnosticoId: c.diagnosticoId,
          procedimentoId: c.procedimentoId,
          tipo: c.tipo,
          funcaoCirurgiaoId: c.funcaoCirurgiaoId,
          clavienDindo: c.clavienDindo,
          anatomiaPatologica: c.anatomiaPatologica,
          observacoes: c.observacoes,
        })),
      );
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        hospitalId,
        action: 'create',
        entityType: 'registo_cirurgico',
        entityId: registo.id,
        after: payload,
      });
      return registo.id;
    });
    return this.findOne(hospitalId, userId, id);
  }

  async update(
    hospitalId: string,
    userId: string,
    id: string,
    payload: UpdateRegisto,
  ): Promise<RegistoDetalhe> {
    const before = await this.findOne(hospitalId, userId, id);
    await this.assertRefs(hospitalId, userId, payload);
    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(registoCirurgicos)
        .set({
          utenteId: payload.utenteId,
          especialidadeId: payload.especialidadeId,
          dataCirurgia: payload.dataCirurgia,
          idadeCirurgia: payload.idadeCirurgia,
          tipoDeCirurgiaId: payload.tipoDeCirurgiaId,
          tipoDeAbordagemId: payload.tipoDeAbordagemId,
          ambulatorio: payload.ambulatorio,
          observacoes: payload.observacoes,
        })
        .where(
          and(
            eq(registoCirurgicos.id, id),
            eq(registoCirurgicos.hospitalId, hospitalId),
            eq(registoCirurgicos.userId, userId),
            isNull(registoCirurgicos.deletedAt),
          ),
        )
        .returning({ id: registoCirurgicos.id });
      if (!updated) {
        throw new NotFoundException('Registo cirúrgico não encontrado.');
      }
      // As cirurgias são detalhe puro do registo (sem filhos): substituem-se por
      // completo em vez de fazer diff — apaga-se o conjunto antigo e insere-se o novo.
      await tx.delete(cirurgias).where(eq(cirurgias.registoCirurgicoId, id));
      await tx.insert(cirurgias).values(
        payload.cirurgias.map((c) => ({
          registoCirurgicoId: id,
          diagnosticoId: c.diagnosticoId,
          procedimentoId: c.procedimentoId,
          tipo: c.tipo,
          funcaoCirurgiaoId: c.funcaoCirurgiaoId,
          clavienDindo: c.clavienDindo,
          anatomiaPatologica: c.anatomiaPatologica,
          observacoes: c.observacoes,
        })),
      );
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        hospitalId,
        action: 'update',
        entityType: 'registo_cirurgico',
        entityId: id,
        before,
        after: payload,
      });
    });
    return this.findOne(hospitalId, userId, id);
  }

  async remove(hospitalId: string, userId: string, id: string): Promise<void> {
    const before = await this.findOne(hospitalId, userId, id);
    await this.db.transaction(async (tx) => {
      const [removed] = await tx
        .update(registoCirurgicos)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(registoCirurgicos.id, id),
            eq(registoCirurgicos.hospitalId, hospitalId),
            eq(registoCirurgicos.userId, userId),
            isNull(registoCirurgicos.deletedAt),
          ),
        )
        .returning({ id: registoCirurgicos.id });
      if (!removed) {
        throw new NotFoundException('Registo cirúrgico não encontrado.');
      }
      // Cirurgias são detalhe sem filhos → hard delete; assim as verificações de
      // referência em diagnósticos/procedimentos (que olham para cirurgias não
      // eliminadas) deixam de ver estas linhas. O registo é soft-deleted.
      await tx.delete(cirurgias).where(eq(cirurgias.registoCirurgicoId, id));
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        hospitalId,
        action: 'delete',
        entityType: 'registo_cirurgico',
        entityId: id,
        before,
      });
    });
  }

  private async loadCirurgias(registoId: string): Promise<CirurgiaDetalhe[]> {
    return this.db
      .select({
        id: cirurgias.id,
        diagnosticoId: cirurgias.diagnosticoId,
        diagnosticoNome: diagnosticos.nome,
        procedimentoId: cirurgias.procedimentoId,
        procedimentoNome: procedimentos.nome,
        tipo: cirurgias.tipo,
        funcaoCirurgiaoId: cirurgias.funcaoCirurgiaoId,
        funcaoCirurgiaoNome: funcaoCirurgiaos.nome,
        clavienDindo: cirurgias.clavienDindo,
        anatomiaPatologica: cirurgias.anatomiaPatologica,
        observacoes: cirurgias.observacoes,
      })
      .from(cirurgias)
      .leftJoin(diagnosticos, eq(cirurgias.diagnosticoId, diagnosticos.id))
      .leftJoin(procedimentos, eq(cirurgias.procedimentoId, procedimentos.id))
      .leftJoin(
        funcaoCirurgiaos,
        eq(cirurgias.funcaoCirurgiaoId, funcaoCirurgiaos.id),
      )
      .where(
        and(
          eq(cirurgias.registoCirurgicoId, registoId),
          isNull(cirurgias.deletedAt),
        ),
      );
  }

  /**
   * Garante que todos os ids referenciados pertencem ao hospital ativo (ou são
   * catálogos globais, hospital_id NULL). Os utentes são estritamente do hospital.
   */
  private async assertRefs(
    hospitalId: string,
    userId: string,
    payload: CreateRegisto,
  ): Promise<void> {
    // Utente: estritamente do hospital.
    const [utente] = await this.db
      .select({ id: utentes.id })
      .from(utentes)
      .where(
        and(
          eq(utentes.id, payload.utenteId),
          eq(utentes.hospitalId, hospitalId),
          eq(utentes.createdByUserId, userId),
          isNull(utentes.deletedAt),
        ),
      )
      .limit(1);
    if (!utente) {
      throw new BadRequestException('Utente inválido.');
    }

    await this.assertShared(
      hospitalId,
      [payload.tipoDeCirurgiaId],
      'Tipo de cirurgia inválido.',
      tipoDeCirurgias,
      tipoDeCirurgiaHospital,
      tipoDeCirurgiaHospital.tipoDeCirurgiaId,
    );
    if (payload.especialidadeId) {
      await this.assertShared(
        hospitalId,
        [payload.especialidadeId],
        'Especialidade inválida.',
        especialidades,
        especialidadeHospital,
        especialidadeHospital.especialidadeId,
      );
    }
    if (payload.tipoDeAbordagemId) {
      await this.assertShared(
        hospitalId,
        [payload.tipoDeAbordagemId],
        'Tipo de abordagem inválido.',
        tipoDeAbordagens,
        tipoDeAbordagemHospital,
        tipoDeAbordagemHospital.tipoDeAbordagemId,
      );
    }

    const diagnosticoIds = [
      ...new Set(payload.cirurgias.map((c) => c.diagnosticoId)),
    ];
    const procedimentoIds = [
      ...new Set(payload.cirurgias.map((c) => c.procedimentoId)),
    ];
    const funcaoIds = [
      ...new Set(
        payload.cirurgias
          .map((c) => c.funcaoCirurgiaoId)
          .filter((v): v is string => v !== null),
      ),
    ];
    // Diagnósticos não são partilháveis: mantêm o âmbito hospital_id / global.
    await this.assertDiagnosticos(
      hospitalId,
      diagnosticoIds,
      'Diagnóstico inválido.',
    );
    await this.assertShared(
      hospitalId,
      procedimentoIds,
      'Procedimento inválido.',
      procedimentos,
      procedimentoHospital,
      procedimentoHospital.procedimentoId,
    );
    if (funcaoIds.length > 0) {
      await this.assertShared(
        hospitalId,
        funcaoIds,
        'Função de cirurgião inválida.',
        funcaoCirurgiaos,
        funcaoCirurgiaoHospital,
        funcaoCirurgiaoHospital.funcaoCirurgiaoId,
      );
    }
  }

  /**
   * Catálogo partilhável: cada id tem de existir e estar disponível no hospital
   * ativo — item global (is_global) ou com associação ativa a este hospital.
   */
  private async assertShared(
    hospitalId: string,
    ids: string[],
    message: string,
    itemTable:
      | typeof especialidades
      | typeof procedimentos
      | typeof funcaoCirurgiaos
      | typeof tipoDeCirurgias
      | typeof tipoDeAbordagens,
    assocTable:
      | typeof especialidadeHospital
      | typeof procedimentoHospital
      | typeof funcaoCirurgiaoHospital
      | typeof tipoDeCirurgiaHospital
      | typeof tipoDeAbordagemHospital,
    assocItemFk:
      | typeof especialidadeHospital.especialidadeId
      | typeof procedimentoHospital.procedimentoId
      | typeof funcaoCirurgiaoHospital.funcaoCirurgiaoId
      | typeof tipoDeCirurgiaHospital.tipoDeCirurgiaId
      | typeof tipoDeAbordagemHospital.tipoDeAbordagemId,
  ): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.db
      .select({ id: itemTable.id })
      .from(itemTable)
      .where(
        and(
          inArray(itemTable.id, ids),
          isNull(itemTable.deletedAt),
          sql`(${itemTable.isGlobal} = true OR ${exists(
            this.db
              .select({ one: sql`1` })
              .from(assocTable)
              .where(
                and(
                  eq(assocItemFk, itemTable.id),
                  eq(assocTable.hospitalId, hospitalId),
                  isNull(assocTable.deletedAt),
                ),
              ),
          )})`,
        ),
      );
    if (found.length !== new Set(ids).size) {
      throw new BadRequestException(message);
    }
  }

  /** Diagnósticos: âmbito hospital_id do próprio item, ou global (hospital_id NULL). */
  private async assertDiagnosticos(
    hospitalId: string,
    ids: string[],
    message: string,
  ): Promise<void> {
    if (ids.length === 0) return;
    const found = await this.db
      .select({ id: diagnosticos.id })
      .from(diagnosticos)
      .where(
        and(
          inArray(diagnosticos.id, ids),
          or(
            eq(diagnosticos.hospitalId, hospitalId),
            isNull(diagnosticos.hospitalId),
          ),
          isNull(diagnosticos.deletedAt),
        ),
      );
    if (found.length !== new Set(ids).size) {
      throw new BadRequestException(message);
    }
  }
}
