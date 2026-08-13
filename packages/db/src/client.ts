import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';

export type Database = NodePgDatabase<typeof schema>;

export function createDb(connectionString: string): { db: Database; pool: Pool } {
  const pool = new Pool({
    connectionString,
    ssl: sslFromConnectionString(connectionString),
  });
  pool.on('error', (err) => {
    console.error('Unexpected error on idle Postgres client', err);
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

function sslFromConnectionString(
  connectionString: string,
): { rejectUnauthorized: boolean } | undefined {
  try {
    const sslmode = new URL(connectionString).searchParams.get('sslmode');
    if (sslmode && sslmode !== 'disable') {
      return { rejectUnauthorized: sslmode !== 'no-verify' };
    }
  } catch {
    // Not a parseable URL — let pg surface the connection error itself.
  }
  return undefined;
}
