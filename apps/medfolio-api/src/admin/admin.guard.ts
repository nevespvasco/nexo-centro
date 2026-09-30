import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { adminUsers, type Database, hospitals } from '@nexo-centro/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { ADMIN_SESSION_COOKIE } from '../auth/auth.constants';
import { readCookie } from '../common/request-cookie';
import { DRIZZLE } from '../database/drizzle.constants';

export interface AdminRequest extends Request {
  adminUserId: string;
  adminHospitalId: string | null;
  adminSessionVersion: number;
}

interface AdminSessionPayload {
  sub: string;
  typ: 'admin_session';
  ver: number;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const token = readCookie(req, ADMIN_SESSION_COOKIE);
    if (!token) throw new UnauthorizedException('Sessão não encontrada.');

    let verified: unknown;
    try {
      verified = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    if (!isAdminSessionPayload(verified)) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    const [admin] = await this.db
      .select({
        id: adminUsers.id,
        hospitalId: adminUsers.hospitalId,
        sessionVersion: adminUsers.sessionVersion,
        hospitalDeletedAt: hospitals.deletedAt,
      })
      .from(adminUsers)
      .leftJoin(hospitals, eq(adminUsers.hospitalId, hospitals.id))
      .where(
        and(
          eq(adminUsers.id, verified.sub),
          eq(adminUsers.isActive, true),
          isNull(adminUsers.deletedAt),
        ),
      )
      .limit(1);
    if (
      !admin ||
      admin.sessionVersion !== verified.ver ||
      (admin.hospitalId !== null && admin.hospitalDeletedAt !== null)
    ) {
      throw new UnauthorizedException('Sessão revogada.');
    }

    req.adminUserId = admin.id;
    req.adminHospitalId = admin.hospitalId;
    req.adminSessionVersion = admin.sessionVersion;
    return true;
  }
}

function isAdminSessionPayload(value: unknown): value is AdminSessionPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === 'string' &&
    payload.typ === 'admin_session' &&
    typeof payload.ver === 'number' &&
    Number.isInteger(payload.ver)
  );
}
