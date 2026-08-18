import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { SESSION_COOKIE, type SessionPayload } from './auth.constants';

export interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) {
      throw new UnauthorizedException('Sessão não encontrada.');
    }

    let payload: SessionPayload;
    try {
      payload = await this.jwtService.verifyAsync<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
    if (payload.typ !== 'session') {
      throw new UnauthorizedException('Sessão inválida.');
    }

    req.user = { id: payload.sub };
    return true;
  }
}
