import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { HospitalScopedRequest } from './hospital-scope.guard';

/** Id do hospital ativo, populado por `HospitalScopeGuard`. */
export const CurrentHospital = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<HospitalScopedRequest>();
  return req.hospitalId!;
});
