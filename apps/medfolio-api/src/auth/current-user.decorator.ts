import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt.guard';

/** Id do utilizador autenticado, populado por `JwtAuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return req.user!.id;
  },
);
