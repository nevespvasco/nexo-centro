import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Multipart uploads send the structured payload as one JSON field. */
export class PortfolioBodyPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    let body = value;
    if (value && typeof value === 'object' && 'payload' in value) {
      const raw = (value as { payload: unknown }).payload;
      if (typeof raw !== 'string') throw new BadRequestException('Payload inválido.');
      try {
        body = JSON.parse(raw);
      } catch {
        throw new BadRequestException('Payload JSON inválido.');
      }
    }
    const parsed = this.schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join('; '));
    }
    return parsed.data;
  }
}
