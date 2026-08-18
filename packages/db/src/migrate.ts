import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../../.env') });

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required — see the "Base de dados (Drizzle)" section in README.md.');
}

// `--local`: reescreve o hostname `db` (rede Docker) para `localhost` para que
// o mesmo .env sirva tanto dentro do container como quando corres a migração
// a partir do host, sem ter de duplicar a variável.
if (process.argv.includes('--local')) {
  const rewritten = databaseUrl.replace(/@db(:\d+)?\//, (_m, port) => `@localhost${port ?? ''}/`);
  if (rewritten !== databaseUrl) {
    console.log('Modo --local: DATABASE_URL apontada para localhost em vez de "db".');
    databaseUrl = rewritten;
  }
}

// Migrador programático em vez de `drizzle-kit migrate`: o CLI do drizzle-kit
// bloqueia sem timeout se não conseguir abrir a ligação (por ex. quando
// DATABASE_URL aponta para um hostname da rede Docker fora do container). Este
// script usa o mesmo migrator que a app usaria em produção e devolve erros
// claros por stderr.
async function main() {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  try {
    const db = drizzle(pool);
    const migrationsFolder = path.resolve(__dirname, '../drizzle');
    await migrate(db, { migrationsFolder });
    console.log('Migrações aplicadas com sucesso.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Falha ao aplicar migrações:', err);
  process.exit(1);
});
