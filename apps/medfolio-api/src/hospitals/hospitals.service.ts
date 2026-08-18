import { Inject, Injectable } from '@nestjs/common';
import { type Database, hospitalUser, hospitals } from '@nexo-centro/db';
import type { HospitalMembership } from '@nexo-centro/schemas';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';

/** Deriva as iniciais (até 2 maiúsculas) a partir do nome do hospital. */
function initialsOf(nome: string): string {
  const words = nome.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[0] ?? '').slice(0, 2).toUpperCase();
}

@Injectable()
export class HospitalsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listApproved(userId: string): Promise<HospitalMembership[]> {
    const rows = await this.db
      .select({ id: hospitals.id, nome: hospitals.nome })
      .from(hospitalUser)
      .innerJoin(hospitals, eq(hospitalUser.hospitalId, hospitals.id))
      .where(
        and(
          eq(hospitalUser.userId, userId),
          eq(hospitalUser.status, 'approved'),
          isNull(hospitalUser.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      )
      .orderBy(asc(hospitals.nome));

    return rows.map((row) => ({ ...row, initials: initialsOf(row.nome) }));
  }
}
