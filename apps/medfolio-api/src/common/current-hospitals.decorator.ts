import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { HospitalReadRequest } from './hospital-read-scope.guard';

export const CurrentHospitals = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string[] => {
    return ctx.switchToHttp().getRequest<HospitalReadRequest>().hospitalIds!;
  },
);
