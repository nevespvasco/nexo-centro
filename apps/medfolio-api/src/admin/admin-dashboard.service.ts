import { Inject, Injectable } from '@nestjs/common';
import {
  hospitalUser,
  registoCirurgicos,
  users,
  type Database,
} from '@nexo-centro/db';
import { and, count, eq, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../database/drizzle.constants';

@Injectable()
export class AdminDashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getMetrics(adminHospitalId: string | null) {
    if (adminHospitalId) {
      const [[totalUsers], [activeUsers], [totalRegistos]] = await Promise.all([
        this.db
          .select({ value: count() })
          .from(users)
          .innerJoin(
            hospitalUser,
            and(
              eq(hospitalUser.userId, users.id),
              eq(hospitalUser.hospitalId, adminHospitalId),
              eq(hospitalUser.status, 'approved'),
              eq(hospitalUser.isActive, true),
              isNull(hospitalUser.deletedAt),
            ),
          )
          .where(isNull(users.deletedAt)),
        this.db
          .select({ value: count() })
          .from(users)
          .innerJoin(
            hospitalUser,
            and(
              eq(hospitalUser.userId, users.id),
              eq(hospitalUser.hospitalId, adminHospitalId),
              eq(hospitalUser.status, 'approved'),
              eq(hospitalUser.isActive, true),
              isNull(hospitalUser.deletedAt),
            ),
          )
          .where(and(isNull(users.deletedAt), eq(users.isActive, true))),
        this.db
          .select({ value: count() })
          .from(registoCirurgicos)
          .where(
            and(
              eq(registoCirurgicos.hospitalId, adminHospitalId),
              isNull(registoCirurgicos.deletedAt),
            ),
          ),
      ]);
      return {
        totalUsers: totalUsers.value,
        activeUsers: activeUsers.value,
        totalRegistosCirurgicos: totalRegistos.value,
      };
    }

    // Super-admin — totais globais
    const [[totalUsers], [activeUsers], [totalRegistos]] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(users)
        .where(isNull(users.deletedAt)),
      this.db
        .select({ value: count() })
        .from(users)
        .where(and(isNull(users.deletedAt), eq(users.isActive, true))),
      this.db
        .select({ value: count() })
        .from(registoCirurgicos)
        .where(isNull(registoCirurgicos.deletedAt)),
    ]);

    return {
      totalUsers: totalUsers.value,
      activeUsers: activeUsers.value,
      totalRegistosCirurgicos: totalRegistos.value,
    };
  }
}
