import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

let databaseUrl =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "MIGRATION_DATABASE_URL or DATABASE_URL is required — see README.md.",
  );
}

// `--local`: reescreve o hostname `db` (rede Docker) para `localhost` para que
// o mesmo .env sirva tanto dentro do container como quando corres a migração
// a partir do host, sem ter de duplicar a variável.
if (process.argv.includes("--local")) {
  const rewritten = databaseUrl.replace(
    /@db(:\d+)?\//,
    (_m, port) => `@localhost${port ?? ""}/`,
  );
  if (rewritten !== databaseUrl) {
    console.log(
      'Modo --local: DATABASE_URL apontada para localhost em vez de "db".',
    );
    databaseUrl = rewritten;
  }
}

// Migrador programático em vez de `drizzle-kit migrate`: o CLI do drizzle-kit
// bloqueia sem timeout se não conseguir abrir a ligação (por ex. quando
// DATABASE_URL aponta para um hostname da rede Docker fora do container). Este
// script usa o mesmo migrator que a app usaria em produção e devolve erros
// claros por stderr.
async function main() {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });
  try {
    const db = drizzle(pool);
    const migrationsFolder = path.resolve(__dirname, "../drizzle");
    await migrate(db, { migrationsFolder });
    await applyApplicationRoleGrants(pool, process.env.APP_DB_USER);
    console.log("Migrações aplicadas com sucesso.");
  } finally {
    await pool.end();
  }
}

async function applyApplicationRoleGrants(
  pool: Pool,
  appDbUser: string | undefined,
): Promise<void> {
  if (!appDbUser) return;
  if (!/^[a-z_][a-z0-9_$]*$/i.test(appDbUser)) {
    throw new Error("APP_DB_USER is not a valid PostgreSQL role name");
  }

  const role = quoteIdentifier(appDbUser);
  const roleExists = await pool.query<{ exists: boolean }>(
    "select exists(select 1 from pg_roles where rolname = $1) as exists",
    [appDbUser],
  );
  if (!roleExists.rows[0]?.exists) {
    throw new Error(
      `PostgreSQL role ${appDbUser} does not exist; run init-app-role.sh first`,
    );
  }

  const database = await pool.query<{ name: string }>(
    "select current_database() as name",
  );
  const databaseName = database.rows[0]?.name;
  if (!databaseName) throw new Error("Could not determine current database");

  await pool.query(
    `GRANT CONNECT ON DATABASE ${quoteIdentifier(databaseName)} TO ${role}`,
  );
  await pool.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await pool.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
  );
  await pool.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
  );
  await pool.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
  );
  await pool.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
  );

  // The runtime role may append/read audit events but cannot rewrite history.
  await pool.query(
    `REVOKE UPDATE, DELETE ON TABLE public.audit_events FROM ${role}`,
  );
  await pool.query(
    `GRANT SELECT, INSERT ON TABLE public.audit_events TO ${role}`,
  );
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

main().catch((err) => {
  console.error("Falha ao aplicar migrações:", err);
  process.exit(1);
});
