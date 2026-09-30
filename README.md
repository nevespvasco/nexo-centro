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
| `APP_DB_USER` | sim | Conta limitada usada em runtime pela API |
| `APP_DB_PASSWORD` | sim | Password exclusiva da conta limitada |
| `DATABASE_URL` | sim | Connection string da conta limitada usada pela API (`APP_DB_USER`) |
| `MIGRATION_DATABASE_URL` | sim | Connection string da conta proprietária, usada apenas nas migrações |
| `CORS_ORIGIN` | sim | Origem permitida pela API (em dev, a URL do `web`) |
| `FRONTEND_URL` | sim | URL pública usada nos links de recuperação de password |
| `JWT_SECRET` | produção | Segredo aleatório usado para assinar sessões |
| `APP_ENCRYPTION_KEY` | produção | Chave AES-256 em base64 para segredos 2FA |
| `SMTP_HOST` / `SMTP_FROM` | produção | Servidor e remetente dos emails de recuperação |
| `NODE_ENV` | não (default `development`) | Ambiente Node da API |
| `CHOKIDAR_USEPOLLING` | não (default `false`) | Ativa polling de ficheiros — útil se o HMR não detectar alterações |

Em falta alguma variável obrigatória, o `docker compose` falha explicitamente a apontar qual falta, em vez de arrancar com strings vazias.

## Produção

```bash
pnpm docker:prod
```

Usa `docker-compose.prod.yml`, que constrói as imagens de produção dos dois apps (build multi-stage, API corre como utilizador não-root) e isola a base de dados numa rede interna sem rota para o exterior.

O arranque executa primeiro todas as migrações com a conta proprietária. A seguir,
reaplica as permissões mínimas da conta da API e impede essa conta de alterar ou
apagar o histórico de auditoria. A API só arranca se esta etapa terminar com
sucesso.

O frontend fica ligado apenas a `127.0.0.1:8080`. Coloca um reverse proxy com
TLS válido à frente dessa porta e publica apenas HTTPS.

Se atualizares um volume Postgres criado antes de existir `APP_DB_USER`, prepara
a conta limitada uma única vez e volta a arrancar a stack:

```bash
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml exec db /docker-entrypoint-initdb.d/10-app-role.sh
pnpm docker:prod
```

### Primeiro responsável de um hospital

Pedidos de acesso ficam pendentes até serem aprovados por um membro autorizado.
Depois de criar o primeiro utilizador e o hospital, atribui o primeiro responsável
através da conta de migração:

```bash
APPROVER_EMAIL=responsavel@example.com \
APPROVER_HOSPITAL_ID=<uuid-do-hospital> \
pnpm db:grant-approver
```

Na stack de produção, o mesmo comando pode ser executado sem expor a conta de
migração à API:

```bash
docker compose -f docker-compose.prod.yml run --rm \
  -e APPROVER_EMAIL=responsavel@example.com \
  -e APPROVER_HOSPITAL_ID=<uuid-do-hospital> \
  migrate node node_modules/@nexo-centro/db/dist/grant-hospital-approver.js
```

A operação exige um utilizador ativo, é transacional e fica registada na tabela
de auditoria.

**Nunca reutilizar as credenciais de exemplo do `.env.example` em produção** — gera uma password forte própria para `POSTGRES_PASSWORD`.

## Base de dados (Drizzle)

O schema, o cliente Drizzle e as migrações vivem em [`packages/db`](packages/db) (`@nexo-centro/db`), consumido pela API via um `DrizzleModule` global (token `DRIZZLE`).

```bash
pnpm db:generate   # gera SQL de migração a partir do schema (não liga à DB)
pnpm db:migrate    # aplica as migrações pendentes
pnpm db:push       # (dev only) sincroniza o schema diretamente, sem gerar SQL
pnpm db:studio     # abre o Drizzle Studio
```

`db:generate` não precisa de ligação à base de dados. `db:migrate`, `db:push` e `db:studio` usam `MIGRATION_DATABASE_URL` (com fallback para `DATABASE_URL`) — o hostname `db` só resolve **dentro** da rede Docker. A partir do host, aponta a conta de migração para `localhost`:

```bash
MIGRATION_DATABASE_URL=postgresql://nexo:<password>@localhost:5432/nexo_centro pnpm db:migrate
```

Ou corre o comando dentro do container da API, onde o hostname `db` já resolve:

```bash
docker compose exec api pnpm --filter @nexo-centro/db db:migrate
```

As migrações SQL geradas ficam em `packages/db/drizzle/` e são commitadas no repositório.
