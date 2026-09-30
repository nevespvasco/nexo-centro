import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { hospitalUser, hospitals } from '@nexo-centro/db';
import type { Database } from '@nexo-centro/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthenticatedRequest } from '../auth/jwt.guard';
import { DRIZZLE } from '../database/drizzle.constants';

export interface HospitalReadRequest extends AuthenticatedRequest {
  hospitalIds?: string[];
}

/** Resolve o âmbito em cada pedido. IDs enviados pelo cliente nunca concedem acesso. */
@Injectable()
export class HospitalReadScopeGuard implements CanActivate {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HospitalReadRequest>();
    if (!req.user?.id)
      throw new UnauthorizedException('Sessão não encontrada.');
    const query = req.query as Record<string, unknown>;
    const scope = query.scope ?? 'all';
    if (scope !== 'all' && scope !== 'selected')
      throw new BadRequestException('Âmbito inválido.');
    const raw = query.hospitalId;
    const requested = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    if (scope === 'all' && requested.length)
      throw new BadRequestException(
        'Não indique hospitais com o âmbito Todos.',
      );
    if (
      scope === 'selected' &&
      (!requested.length ||
        requested.some(
          (id) =>
            typeof id !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              id,
            ),
        ))
    ) {
      throw new BadRequestException('Selecione pelo menos um hospital válido.');
    }
    const memberships = await this.db
      .select({ id: hospitals.id })
      .from(hospitalUser)
      .innerJoin(hospitals, eq(hospitalUser.hospitalId, hospitals.id))
      .where(
        and(
          eq(hospitalUser.userId, req.user.id),
          eq(hospitalUser.status, 'approved'),
          eq(hospitalUser.isActive, true),
          isNull(hospitalUser.deletedAt),
          isNull(hospitals.deletedAt),
        ),
      );
    const approved = new Set(memberships.map((m) => m.id));
    if (!approved.size)
      throw new ForbiddenException('Sem hospitais disponíveis.');
    if (requested.some((id) => !approved.has(id as string)))
      throw new ForbiddenException(
        'Sem acesso a um dos hospitais selecionados.',
      );
    req.hospitalIds =
      scope === 'all' ? [...approved] : [...new Set(requested as string[])];
    if (
      req.hospitalIds.length > 1 &&
      [
        'diagnosticoId',
        'procedimentoId',
        'funcaoCirurgiaoId',
        'tipoDeCirurgiaIds',
      ].some((key) => query[key] !== undefined)
    ) {
      throw new BadRequestException(
        'Filtros de catálogos locais exigem um único hospital.',
      );
    }
    return true;
  }
}
