import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { type Database, hospitalUser, hospitals } from '@nexo-centro/db';
import { hospitalIdSchema } from '@nexo-centro/schemas';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../auth/jwt.guard';
import { DRIZZLE } from '../database/drizzle.constants';
import { HOSPITAL_HEADER } from './tenant.constants';

export interface HospitalScopedRequest extends AuthenticatedRequest {
  hospitalId?: string;
}

/**
 * Runs after `JwtAuthGuard`. Revalidates, on every request, that the
 * authenticated user has an `approved` membership in the hospital named by
 * the `X-Hospital-Id` header — the client's stored active hospital is never
 * trusted on its own. Endpoints using this guard MUST filter every query by
 * BOTH `hospitalId` (`@CurrentHospital()`) AND `userId` (`@CurrentUser()`):
 * hospital scoping alone would still leak other users' records within the
 * same hospital.
 */
@Injectable()
export class HospitalScopeGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HospitalScopedRequest>();
    if (!req.user?.id) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }

    const header = req.headers[HOSPITAL_HEADER];
    const result = hospitalIdSchema.safeParse(header);
    if (!result.success) {
      throw new BadRequestException(
        'Cabeçalho X-Hospital-Id em falta ou inválido.',
      );
    }
    const hospitalId = result.data;

    const [membership] = await this.db
      .select({ id: hospitalUser.id })
      .from(hospitalUser)
      .innerJoin(hospitals, eq(hospitalUser.hospitalId, hospitals.id))
      .where(
        and(
          eq(hospitalUser.userId, req.user.id),
          eq(hospitalUser.hospitalId, hospitalId),
          eq(hospitalUser.status, 'approved'),
          eq(hospitalUser.isActive, true),
          isNull(hospitalUser.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      )
      .limit(1);
    if (!membership) {
      throw new ForbiddenException('Sem acesso a este hospital.');
    }

    req.hospitalId = hospitalId;
    return true;
  }
}
