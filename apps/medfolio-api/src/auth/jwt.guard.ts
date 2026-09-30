import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type Database, users } from '@nexo-centro/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { Request } from 'express';
import { readCookie } from '../common/request-cookie';
import { DRIZZLE } from '../database/drizzle.constants';
import { SESSION_COOKIE, type SessionPayload } from './auth.constants';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; sessionVersion: number };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(req, SESSION_COOKIE);
    if (!token) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }

    let verified: unknown;
    try {
      verified = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    if (!isSessionPayload(verified)) {
      throw new UnauthorizedException('Sessão inválida.');
    }
    const payload = verified;

    const [user] = await this.db
      .select({ id: users.id, sessionVersion: users.sessionVersion })
      .from(users)
      .where(
        and(
          eq(users.id, payload.sub),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    if (!user || user.sessionVersion !== payload.ver) {
      throw new UnauthorizedException('Sessão revogada.');
    }

    req.user = user;
    return true;
  }
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === 'string' &&
    payload.typ === 'session' &&
    typeof payload.ver === 'number' &&
    Number.isInteger(payload.ver)
  );
}
