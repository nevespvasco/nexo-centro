import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { type Database } from '@nexo-centro/db';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from './database/drizzle.constants';

@Injectable()
export class AppService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth(): Promise<{ status: 'ok'; service: string }> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', service: 'medfolio-api' };
    } catch {
      throw new ServiceUnavailableException('Base de dados indisponível.');
    }
  }
}
