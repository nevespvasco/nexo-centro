import { Global, Module, Inject, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDb, type Database } from '@nexo-centro/db';
import { DRIZZLE } from './drizzle.constants';

const PG_CONNECTION = Symbol('PG_CONNECTION');

type PgConnection = ReturnType<typeof createDb>;

@Global()
@Module({
  providers: [
    {
      provide: PG_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PgConnection =>
        createDb(config.getOrThrow<string>('DATABASE_URL')),
    },
    {
      provide: DRIZZLE,
      inject: [PG_CONNECTION],
      useFactory: (conn: PgConnection): Database => conn.db,
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule implements OnModuleDestroy {
  constructor(@Inject(PG_CONNECTION) private readonly conn: PgConnection) {}

  async onModuleDestroy(): Promise<void> {
    await this.conn.pool.end();
  }
}
