import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  auditEvents,
  hospitalUser,
  hospitals,
  type Database,
} from '@nexo-centro/db';
import type { CatalogoHospital } from '@nexo-centro/schemas';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { and, asc, eq, exists, inArray, isNull, ne, sql } from 'drizzle-orm';
import { pgConstraintName, pgErrorCode } from './pg-error.util';

// Chaves JS (não os nomes SQL) partilhadas por todos os catálogos/associações.
// `select()` e `.set()/.values()` do drizzle usam as chaves JS das colunas.
const ITEM = {
  id: 'id',
  nome: 'nome',
  isGlobal: 'isGlobal',
  createdBy: 'createdByUserId',
  ordem: 'ordem',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  deletedAt: 'deletedAt',
} as const;
const ASSOC = {
  hospitalId: 'hospitalId',
  createdBy: 'createdByUserId',
  ordem: 'ordem',
  deletedAt: 'deletedAt',
} as const;

/** Dependência que tem de estar disponível no hospital de destino (ex.: procedimento→especialidade). */
export interface CatalogDependency {
  /** Chave JS da coluna do item que aponta para a dependência (ex.: 'especialidadeId'). */
  valueKey: string;
  depItemTable: PgTable;
  depId: PgColumn;
  depIsGlobal: PgColumn;
  depDeletedAt: PgColumn;
  depAssocTable: PgTable;
  depAssocItemFk: PgColumn;
  depAssocHospitalId: PgColumn;
  depAssocDeletedAt: PgColumn;
  message: string;
}

/** Tabela que pode referenciar o item, para bloquear remoção/desassociação. */
export interface CatalogUsage {
  table: PgTable;
  itemFk: PgColumn;
  deletedAt?: PgColumn;
  /** Se presente, a utilização é do âmbito de um hospital (relevante à desassociação). */
  hospitalColumn?: PgColumn;
  message: string;
}

export interface SharedCatalogConfig {
  entityType: string;
  labels: { notFound: string; duplicate: string };
  /** Nome do índice único global (nome único entre itens globais). */
  globalNameConstraint: string;
  item: {
    table: PgTable;
    id: PgColumn;
    nome: PgColumn;
    isGlobal: PgColumn;
    deletedAt: PgColumn;
  };
  assoc: {
    table: PgTable;
    id: PgColumn;
    itemFk: PgColumn;
    /** Chave JS da FK do item na associação (ex.: 'especialidadeId'). */
    itemFkKey: string;
    hospitalId: PgColumn;
    deletedAt: PgColumn;
    ordem?: PgColumn;
  };
  /** Extrai as colunas de conteúdo (chaves JS) do payload de create/update. */
  pickContent: (payload: Record<string, unknown>) => Record<string, unknown>;
  ordenable?: boolean;
  dependency?: CatalogDependency;
  usages: CatalogUsage[];
}

export interface SharedCatalogRow {
  id: string;
  nome: string;
  isGlobal: boolean;
  createdByUserId: string | null;
  hospitais: CatalogoHospital[];
  editable: boolean;
  ordem?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  [key: string]: unknown;
}

/**
 * Lógica partilhada dos seis catálogos partilháveis (um item, N hospitais).
 * Registada uma vez por catálogo com a respetiva configuração de tabelas.
 *
 * Permissões (utilizador comum): só o criador altera conteúdo/associações e só
 * enquanto tiver acesso aprovado a TODOS os hospitais associados; itens sem
 * criador (legado) só podem ser geridos por administrador. A gestão por
 * administrador hospitalar / superadministrador vive na área /admin.
 */
export class SharedCatalogService {
  constructor(
    private readonly db: Database,
    private readonly cfg: SharedCatalogConfig,
  ) {}

  private get itemTable() {
    return this.cfg.item.table;
  }
  private get assocTable() {
    return this.cfg.assoc.table;
  }

  /** Hospitais em que o utilizador tem adesão aprovada e ativa. */
  private async approvedHospitalIds(userId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ id: hospitalUser.hospitalId })
      .from(hospitalUser)
      .innerJoin(hospitals, eq(hospitalUser.hospitalId, hospitals.id))
      .where(
        and(
          eq(hospitalUser.userId, userId),
          eq(hospitalUser.status, 'approved'),
          eq(hospitalUser.isActive, true),
          isNull(hospitalUser.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      );
    return new Set(rows.map((r) => r.id));
  }

  /** Hospitais atualmente associados (ativos) a um item. */
  private async associatedHospitalIds(itemId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: this.cfg.assoc.hospitalId })
      .from(this.assocTable)
      .where(
        and(
          eq(this.cfg.assoc.itemFk, itemId),
          isNull(this.cfg.assoc.deletedAt),
        ),
      );
    return rows.map((r) => r.id as string);
  }

  private async loadItem(itemId: string): Promise<Record<string, unknown>> {
    const [row] = await this.db
      .select()
      .from(this.itemTable)
      .where(and(eq(this.cfg.item.id, itemId), isNull(this.cfg.item.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException(this.cfg.labels.notFound);
    return row;
  }

  /** EXISTS correlacionado: existe uma associação ativa deste item ao hospital dado. */
  private existsAssocFor(itemIdColumn: PgColumn, hospitalId: string) {
    return exists(
      this.db
        .select({ one: sql`1` })
        .from(this.assocTable)
        .where(
          and(
            eq(this.cfg.assoc.itemFk, itemIdColumn),
            eq(this.cfg.assoc.hospitalId, hospitalId),
            isNull(this.cfg.assoc.deletedAt),
          ),
        ),
    );
  }

  /**
   * Garante que o utilizador pode gerir o item: é o criador e tem acesso
   * aprovado a todos os hospitais associados.
   */
  private async assertEditable(
    userId: string,
    itemId: string,
  ): Promise<{ item: Record<string, unknown>; associated: string[] }> {
    const item = await this.loadItem(itemId);
    const creator = (item[ITEM.createdBy] as string | null) ?? null;
    if (creator == null) {
      throw new ForbiddenException(
        'Item sem criador identificável: só um administrador o pode gerir.',
      );
    }
    if (creator !== userId) {
      throw new ForbiddenException('Sem permissão para gerir este item.');
    }
    const associated = await this.associatedHospitalIds(itemId);
    const approved = await this.approvedHospitalIds(userId);
    if (associated.some((h) => !approved.has(h))) {
      throw new ForbiddenException(
        'Sem acesso a todos os hospitais associados a este item.',
      );
    }
    return { item, associated };
  }

  /** Rejeita se já existir outro item com o mesmo nome disponível em algum destes hospitais. */
  private async assertNameFree(
    nome: string,
    hospitalIds: string[],
    exceptId?: string,
  ): Promise<void> {
    for (const hospitalId of hospitalIds) {
      const [clash] = await this.db
        .select({ id: this.cfg.item.id })
        .from(this.itemTable)
        .where(
          and(
            eq(this.cfg.item.nome, nome),
            isNull(this.cfg.item.deletedAt),
            exceptId ? ne(this.cfg.item.id, exceptId) : undefined,
            this.existsAssocFor(this.cfg.item.id, hospitalId),
          ),
        )
        .limit(1);
      if (clash) throw new BadRequestException(this.cfg.labels.duplicate);
    }
  }

  /** Rejeita se a dependência do item não estiver disponível (global ou associada) no hospital. */
  private async assertDependencyAvailable(
    hospitalId: string,
    depId: unknown,
  ): Promise<void> {
    const dep = this.cfg.dependency;
    if (!dep || depId == null) return;
    const [ok] = await this.db
      .select({ id: dep.depId })
      .from(dep.depItemTable)
      .where(
        and(
          eq(dep.depId, depId as string),
          isNull(dep.depDeletedAt),
          sql`(${dep.depIsGlobal} = true OR ${exists(
            this.db
              .select({ one: sql`1` })
              .from(dep.depAssocTable)
              .where(
                and(
                  eq(dep.depAssocItemFk, dep.depId),
                  eq(dep.depAssocHospitalId, hospitalId),
                  isNull(dep.depAssocDeletedAt),
                ),
              ),
          )})`,
        ),
      )
      .limit(1);
    if (!ok) throw new BadRequestException(dep.message);
  }

  /** Rejeita remoção se o item for referenciado por dados (em qualquer hospital). */
  private async assertNotUsedAnywhere(itemId: string): Promise<void> {
    for (const usage of this.cfg.usages) {
      const [used] = await this.db
        .select({ id: usage.itemFk })
        .from(usage.table)
        .where(
          and(
            eq(usage.itemFk, itemId),
            usage.deletedAt ? isNull(usage.deletedAt) : undefined,
          ),
        )
        .limit(1);
      if (used) throw new BadRequestException(usage.message);
    }
  }

  /** Rejeita desassociação se dados desse hospital ainda referenciarem o item. */
  private async assertNotUsedInHospital(
    itemId: string,
    hospitalId: string,
  ): Promise<void> {
    for (const usage of this.cfg.usages) {
      if (!usage.hospitalColumn) continue;
      const [used] = await this.db
        .select({ id: usage.itemFk })
        .from(usage.table)
        .where(
          and(
            eq(usage.itemFk, itemId),
            eq(usage.hospitalColumn, hospitalId),
            usage.deletedAt ? isNull(usage.deletedAt) : undefined,
          ),
        )
        .limit(1);
      if (used) throw new BadRequestException(usage.message);
    }
  }

  private async audit(
    tx: Database,
    args: {
      userId: string;
      hospitalId?: string;
      action: string;
      entityId: string;
      before?: unknown;
      after?: unknown;
    },
  ): Promise<void> {
    await tx.insert(auditEvents).values({
      actorUserId: args.userId,
      hospitalId: args.hospitalId ?? null,
      action: args.action,
      entityType: this.cfg.entityType,
      entityId: args.entityId,
      before: args.before ?? null,
      after: args.after ?? null,
    });
  }

  private mapWriteError(err: unknown): Error {
    if (pgConstraintName(err) === this.cfg.globalNameConstraint) {
      return new BadRequestException(this.cfg.labels.duplicate);
    }
    if (pgErrorCode(err) === '23503') {
      return new BadRequestException(
        'Não é possível eliminar: está a ser usado.',
      );
    }
    return err instanceof Error ? err : new Error(String(err));
  }

  // --- API pública -----------------------------------------------------------

  async list(
    hospitalIds: string[],
    userId: string,
  ): Promise<SharedCatalogRow[]> {
    const approved = await this.approvedHospitalIds(userId);

    const items = (await this.db
      .select()
      .from(this.itemTable)
      .where(
        and(
          isNull(this.cfg.item.deletedAt),
          sql`(${this.cfg.item.isGlobal} = true OR ${exists(
            this.db
              .select({ one: sql`1` })
              .from(this.assocTable)
              .where(
                and(
                  eq(this.cfg.assoc.itemFk, this.cfg.item.id),
                  inArray(this.cfg.assoc.hospitalId, hospitalIds),
                  isNull(this.cfg.assoc.deletedAt),
                ),
              ),
          )})`,
        ),
      )
      .orderBy(asc(this.cfg.item.nome))) as Record<string, unknown>[];

    if (!items.length) return [];
    const itemIds = items.map((r) => r[ITEM.id] as string);

    const assocRows = (await this.db
      .select({
        itemId: this.cfg.assoc.itemFk,
        hospitalId: this.cfg.assoc.hospitalId,
        hospitalNome: hospitals.nome,
        ordem: this.cfg.assoc.ordem ?? this.cfg.assoc.hospitalId,
      })
      .from(this.assocTable)
      .innerJoin(hospitals, eq(this.cfg.assoc.hospitalId, hospitals.id))
      .where(
        and(
          inArray(this.cfg.assoc.itemFk, itemIds),
          isNull(this.cfg.assoc.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      )) as {
      itemId: string;
      hospitalId: string;
      hospitalNome: string;
      ordem: number | string;
    }[];

    const byItem = new Map<string, typeof assocRows>();
    for (const r of assocRows) {
      if (!approved.has(r.hospitalId)) continue;
      const arr = byItem.get(r.itemId) ?? [];
      arr.push(r);
      byItem.set(r.itemId, arr);
    }

    const singleHospital = hospitalIds.length === 1 ? hospitalIds[0] : null;
    const rows: SharedCatalogRow[] = items.map((item) => {
      const iid = item[ITEM.id] as string;
      const assocs = byItem.get(iid) ?? [];
      const associated = assocs.map((r) => r.hospitalId);
      const creator = (item[ITEM.createdBy] as string | null) ?? null;
      const editable =
        creator === userId && associated.every((h) => approved.has(h));
      const row: SharedCatalogRow = {
        ...(item as object),
        id: iid,
        nome: item[ITEM.nome] as string,
        isGlobal: item[ITEM.isGlobal] as boolean,
        createdByUserId: creator,
        hospitais: assocs.map((r) => ({
          id: r.hospitalId,
          nome: r.hospitalNome,
        })),
        editable,
        createdAt: item[ITEM.createdAt] as Date,
        updatedAt: item[ITEM.updatedAt] as Date,
        deletedAt: (item[ITEM.deletedAt] as Date | null) ?? null,
      };
      if (this.cfg.ordenable) {
        const perHospital = singleHospital
          ? assocs.find((r) => r.hospitalId === singleHospital)?.ordem
          : undefined;
        row.ordem = Number(perHospital ?? item[ITEM.ordem] ?? 0);
      }
      return row;
    });

    if (this.cfg.ordenable) {
      rows.sort(
        (x, y) =>
          (x.ordem ?? 0) - (y.ordem ?? 0) || x.nome.localeCompare(y.nome),
      );
    }
    return rows;
  }

  async create(
    userId: string,
    hospitalId: string,
    payload: Record<string, unknown>,
  ): Promise<SharedCatalogRow> {
    const approved = await this.approvedHospitalIds(userId);
    if (!approved.has(hospitalId)) {
      throw new ForbiddenException('Sem acesso a este hospital.');
    }
    const content = this.cfg.pickContent(payload);
    const nome = content[ITEM.nome] as string;
    if (this.cfg.dependency) {
      await this.assertDependencyAvailable(
        hospitalId,
        payload[this.cfg.dependency.valueKey],
      );
    }
    await this.assertNameFree(nome, [hospitalId]);
    let itemId: string;
    try {
      itemId = await this.db.transaction(async (tx) => {
        const [item] = (await tx
          .insert(this.itemTable)
          .values({
            ...content,
            [ITEM.isGlobal]: false,
            [ITEM.createdBy]: userId,
          } as never)
          .returning()) as Record<string, unknown>[];
        const id = item[ITEM.id] as string;
        await tx.insert(this.assocTable).values({
          [this.cfg.assoc.itemFkKey]: id,
          [ASSOC.hospitalId]: hospitalId,
          [ASSOC.createdBy]: userId,
        } as never);
        await this.audit(tx, {
          userId,
          hospitalId,
          action: 'create',
          entityId: id,
          after: item,
        });
        return id;
      });
    } catch (err) {
      throw this.mapWriteError(err);
    }
    const row = (await this.list([hospitalId], userId)).find(
      (r) => r.id === itemId,
    );
    if (!row) throw new NotFoundException(this.cfg.labels.notFound);
    return row;
  }

  async updateContent(
    userId: string,
    id: string,
    content: Record<string, unknown>,
  ): Promise<SharedCatalogRow> {
    const { item, associated } = await this.assertEditable(userId, id);
    const patch = this.cfg.pickContent(content);
    const newName = patch[ITEM.nome] as string | undefined;
    if (newName && newName !== item[ITEM.nome]) {
      await this.assertNameFree(newName, associated, id);
    }
    if (this.cfg.dependency && this.cfg.dependency.valueKey in patch) {
      for (const hospitalId of associated) {
        await this.assertDependencyAvailable(
          hospitalId,
          patch[this.cfg.dependency.valueKey],
        );
      }
    }
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .update(this.itemTable)
          .set(patch)
          .where(eq(this.cfg.item.id, id));
        await this.audit(tx, {
          userId,
          action: 'update',
          entityId: id,
          before: item,
          after: { ...item, ...patch },
        });
      });
    } catch (err) {
      throw this.mapWriteError(err);
    }
    return this.loadRow(id, userId);
  }

  private async loadRow(id: string, userId: string): Promise<SharedCatalogRow> {
    const associated = await this.associatedHospitalIds(id);
    const row = (await this.list(associated, userId)).find((r) => r.id === id);
    // Item global sem associações: procurar no âmbito aprovado do utilizador.
    if (row) return row;
    const approved = [...(await this.approvedHospitalIds(userId))];
    const fallback = (await this.list(approved, userId)).find(
      (r) => r.id === id,
    );
    if (!fallback) throw new NotFoundException(this.cfg.labels.notFound);
    return fallback;
  }

  async associate(
    userId: string,
    id: string,
    hospitalId: string,
  ): Promise<void> {
    const { item, associated } = await this.assertEditable(userId, id);
    const approved = await this.approvedHospitalIds(userId);
    if (!approved.has(hospitalId)) {
      throw new ForbiddenException('Sem acesso ao hospital de destino.');
    }
    if (associated.includes(hospitalId)) return; // idempotente
    if (this.cfg.dependency) {
      await this.assertDependencyAvailable(
        hospitalId,
        item[this.cfg.dependency.valueKey],
      );
    }
    await this.assertNameFree(item[ITEM.nome] as string, [hospitalId], id);
    try {
      await this.db.transaction(async (tx) => {
        const restored = await tx
          .update(this.assocTable)
          .set({ [ASSOC.deletedAt]: null })
          .where(
            and(
              eq(this.cfg.assoc.itemFk, id),
              eq(this.cfg.assoc.hospitalId, hospitalId),
            ),
          )
          .returning({ id: this.cfg.assoc.id });
        if (!restored.length) {
          await tx.insert(this.assocTable).values({
            [this.cfg.assoc.itemFkKey]: id,
            [ASSOC.hospitalId]: hospitalId,
            [ASSOC.createdBy]: userId,
          } as never);
        }
        await this.audit(tx, {
          userId,
          hospitalId,
          action: 'associate',
          entityId: id,
        });
      });
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  async disassociate(
    userId: string,
    id: string,
    hospitalId: string,
  ): Promise<void> {
    const { associated } = await this.assertEditable(userId, id);
    if (!associated.includes(hospitalId)) {
      throw new NotFoundException('Associação não encontrada.');
    }
    await this.assertNotUsedInHospital(id, hospitalId);
    await this.db.transaction(async (tx) => {
      await tx
        .update(this.assocTable)
        .set({ [ASSOC.deletedAt]: new Date() })
        .where(
          and(
            eq(this.cfg.assoc.itemFk, id),
            eq(this.cfg.assoc.hospitalId, hospitalId),
            isNull(this.cfg.assoc.deletedAt),
          ),
        );
      await this.audit(tx, {
        userId,
        hospitalId,
        action: 'disassociate',
        entityId: id,
      });
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const { item } = await this.assertEditable(userId, id);
    await this.assertNotUsedAnywhere(id);
    try {
      await this.db.transaction(async (tx) => {
        const now = new Date();
        await tx
          .update(this.itemTable)
          .set({ [ITEM.deletedAt]: now })
          .where(eq(this.cfg.item.id, id));
        await tx
          .update(this.assocTable)
          .set({ [ASSOC.deletedAt]: now })
          .where(
            and(
              eq(this.cfg.assoc.itemFk, id),
              isNull(this.cfg.assoc.deletedAt),
            ),
          );
        await this.audit(tx, {
          userId,
          action: 'delete',
          entityId: id,
          before: item,
        });
      });
    } catch (err) {
      throw this.mapWriteError(err);
    }
  }

  /** Reordena, por hospital, os itens disponíveis nesse hospital (só zonas anatómicas). */
  async reorder(
    hospitalId: string,
    items: { id: string; ordem: number }[],
  ): Promise<void> {
    if (!this.cfg.assoc.ordem) {
      throw new BadRequestException('Este catálogo não é ordenável.');
    }
    if (!items.length) return;
    await this.db.transaction(async (tx) => {
      for (const { id, ordem } of items) {
        await tx
          .update(this.assocTable)
          .set({ [ASSOC.ordem]: ordem })
          .where(
            and(
              eq(this.cfg.assoc.itemFk, id),
              eq(this.cfg.assoc.hospitalId, hospitalId),
              isNull(this.cfg.assoc.deletedAt),
            ),
          );
      }
    });
  }
}
