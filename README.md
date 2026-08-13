# nexo-centro

Monorepo (pnpm workspaces) com dois apps:

- **`apps/medfolio`** — frontend React + Vite.
- **`apps/medfolio-api`** — API NestJS.

A pasta [`docs/`](docs/) tem documentação de business logic (obtida por engenharia reversa do código) de três domínios de negócio relacionados: `listaEspera`, `MedTrack` e `morbimortalidade`.

## Arranque rápido (Docker)

```bash
cp .env.example .env
```

Preenche o `.env` com valores próprios (ver [Variáveis de ambiente](#variáveis-de-ambiente) abaixo), depois:

```bash
pnpm docker:dev
```

| Serviço | URL |
|---|---|
| Web (medfolio) | http://localhost:5173 |
| API (medfolio-api) | http://localhost:3001 |
| Postgres | `127.0.0.1:5432` (só acessível localmente) |

Outros comandos úteis:

```bash
pnpm docker:down    # parar e remover os containers
pnpm docker:deps    # correr só o pnpm install dentro do container
pnpm docker:prod    # subir a stack de produção (docker-compose.prod.yml)
```

### ⚠️ Contexto Docker (importante)

Esta máquina tem **dois daemons Docker configurados** (`docker context ls`): o Docker Engine nativo (`default`) e o Docker Desktop (`desktop-linux`). Confirma sempre qual está activo:

```bash
docker context ls
```

O contexto usado nesta máquina é o `desktop-linux`. Para mudar de contexto:

```bash
docker context use desktop-linux
```

Historicamente, um arranque acidental no contexto `default` (Docker Engine nativo, onde root no container = root no host) deixou ficheiros `root:root` num bind mount, o que bloqueou o `nest --watch` com `EACCES` ao tentar reescrever `dist/`. Isso já não deve acontecer em nenhum dos dois daemons: a imagem de dev (`Dockerfile.dev`) corre como o utilizador não-root `node` (uid 1000, igual ao utilizador do host), portanto qualquer ficheiro criado dentro do bind mount fica com o dono correto independentemente do daemon. Mesmo assim, mantém-te no `desktop-linux` por consistência com o resto da equipa.

### Porque existe o serviço `deps`

`deps` só corre `pnpm install --frozen-lockfile` e depois termina (código de saída 0) — é normal aparecer "parado" no `docker compose ps`. Os serviços `api` e `web` esperam por ele (`depends_on: deps: condition: service_completed_successfully`) antes de arrancar, para garantir que os `node_modules` partilhados (volumes nomeados) estão instalados antes de qualquer um dos dois tentar correr.

## Variáveis de ambiente

Definidas em `.env` (não commitado — ver `.env.example`):

| Variável | Obrigatória | Descrição |
|---|---|---|
| `POSTGRES_USER` | sim | Utilizador do Postgres |
| `POSTGRES_PASSWORD` | sim | Password do Postgres |
| `POSTGRES_DB` | sim | Nome da base de dados |
| `DATABASE_URL` | sim | Connection string usada pela API — tem de corresponder às três variáveis acima |
| `CORS_ORIGIN` | sim | Origem permitida pela API (em dev, a URL do `web`) |
| `NODE_ENV` | não (default `development`) | Ambiente Node da API |
| `CHOKIDAR_USEPOLLING` | não (default `false`) | Ativa polling de ficheiros — útil se o HMR não detectar alterações |

Em falta alguma variável obrigatória, o `docker compose` falha explicitamente a apontar qual falta, em vez de arrancar com strings vazias.

## Produção

```bash
pnpm docker:prod
```

Usa `docker-compose.prod.yml`, que constrói as imagens de produção dos dois apps (build multi-stage, API corre como utilizador não-root) e isola a base de dados numa rede interna sem rota para o exterior.

**Nunca reutilizar as credenciais de exemplo do `.env.example` em produção** — gera uma password forte própria para `POSTGRES_PASSWORD`.

## Base de dados (Drizzle)

O schema, o cliente Drizzle e as migrações vivem em [`packages/db`](packages/db) (`@nexo-centro/db`), consumido pela API via um `DrizzleModule` global (token `DRIZZLE`).

```bash
pnpm db:generate   # gera SQL de migração a partir do schema (não liga à DB)
pnpm db:migrate    # aplica as migrações pendentes
pnpm db:push       # (dev only) sincroniza o schema diretamente, sem gerar SQL
pnpm db:studio     # abre o Drizzle Studio
```

`db:generate` não precisa de ligação à base de dados. `db:migrate`, `db:push` e `db:studio` precisam — e o `DATABASE_URL` do `.env` usa o hostname `db`, que só resolve **dentro** da rede Docker. A partir do host, corre-os com `localhost`:

```bash
DATABASE_URL=postgresql://nexo:<password>@localhost:5432/nexo_centro pnpm db:migrate
```

Ou corre o comando dentro do container da API, onde o hostname `db` já resolve:

```bash
docker compose exec api pnpm --filter @nexo-centro/db db:migrate
```

As migrações SQL geradas ficam em `packages/db/drizzle/` e são commitadas no repositório.
