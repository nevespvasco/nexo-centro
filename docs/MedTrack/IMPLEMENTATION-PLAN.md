# Plano de Implementação (file-by-file) — Paridade MedTrack → MedFolio

> Companheiro do [`GAP-ANALYSIS.md`](./GAP-ANALYSIS.md). Aqui está **o que mexer em cada ficheiro**, por ordem de execução, com comandos e verificação. Mantém-se a arquitetura multi-tenant por hospital.

## Convenções do repo (a respeitar em tudo)

- **Monorepo pnpm**: `packages/db` (Drizzle schema + migrations), `packages/schemas` (Zod, contrato partilhado), `apps/medfolio-api` (NestJS), `apps/medfolio` (React/Vite + PrimeReact).
- **Fluxo de alteração de dados**: editar `packages/db/src/schema/*` → `pnpm db:generate` (gera SQL em `packages/db/drizzle/`) → `pnpm db:migrate:local` → **rebuild do package** (`pnpm --filter @nexo-centro/db build`). Os apps consomem `dist/`, por isso **um schema novo só chega à API depois do build do package**.
- **Contrato Zod**: editar `packages/schemas/src/*` → export em `src/index.ts` → `pnpm --filter @nexo-centro/schemas build`.
- **Módulo NestJS novo**: pasta com `*.module.ts` + `*.controller.ts` + `*.service.ts`; registar em `apps/medfolio-api/src/app.module.ts`.
- **Guardas**: rotas por-tenant usam `@UseGuards(JwtAuthGuard, HospitalScopeGuard)` + `@CurrentHospital()` + `@CurrentUser()`; validação com `new ZodValidationPipe(schema)`. **Toda a query filtra por `hospitalId` E `userId`** (ver comentário no `HospitalScopeGuard`).
- **Frontend**: página em `apps/medfolio/src/pages`, cliente em `apps/medfolio/src/lib/api.ts`, rota em `App.tsx` (mapa `CRUD_PAGES`), navegação em `shell/nav.config.ts`. PrimeReact (`DataTable`, `Dialog`, `Toast`, `confirmDialog`).
- ⚠️ **Docker**: `pnpm add` no host **não chega aos containers dev** (ver memória do projeto). Instalar deps novas **dentro do container** (`docker compose run --rm deps` ou `docker compose exec <svc> pnpm add ...`).
- **Verificação por vaga**: `pnpm -r typecheck` + `pnpm --filter medfolio-api build` + `pnpm --filter medfolio build`.

---

## VAGA 0 — Segurança (P0)

### 0.1 Rate limiting (login, 2FA, reset)
- **Dep nova**: `@nestjs/throttler` — instalar no container da API.
- **Criar** `apps/medfolio-api/src/common/throttler.module.ts` *(opcional)* ou configurar direto no `app.module.ts`.
- **Modificar** `apps/medfolio-api/src/app.module.ts`: importar `ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])` (default global generoso) e registar `APP_GUARD` → `ThrottlerGuard`.
- **Modificar** `apps/medfolio-api/src/auth/auth.controller.ts`: `@Throttle({ default: { limit: 5, ttl: 60000 } })` em `login`, `loginTwoFactor`, `forgotPassword`, `resetPassword`. Chave por IP (default) — chega para paridade com o MedTrack (`Limit::perMinute(5)`).
- **Edge**: por trás de nginx/proxy, garantir `app.set('trust proxy', 1)` em `main.ts` para o IP real; caso contrário todos partilham o IP do proxy.
- **Verificação**: 6.ª tentativa de login < 60s → 429.

### 0.2 Confirmar bloqueio de conta inativa
- **Estado**: já implementado (`auth.service.ts::login` lança `Conta inativa.` se `!user.isActive`). **Nada a fazer** — só confirmar teste manual.

---

## VAGA 1 — Núcleo de registo: lookup de utente + filtros (P1)

### 1.1 Lookup de utente por nº de processo
- **Modificar** `apps/medfolio-api/src/utentes/utentes.service.ts`: método `findByProcesso(hospitalId, processo)` → devolve utente do hospital ou `null` (scope estrito por `hospitalId`, `isNull(deletedAt)`).
- **Modificar** `apps/medfolio-api/src/utentes/utentes.controller.ts`: `@Get('processo/:processo')` **antes** de `@Get(':id')` (ordem de rotas), devolve `{ utente: Utente | null }`. Sem `ParseUUIDPipe` (processo é texto).
- **Modificar** `apps/medfolio/src/lib/api.ts`: `getUtenteByProcesso(processo): Promise<{ utente: Utente | null }>`.
- **Edge**: processo inexistente → 200 `{utente:null}` (não 404); nunca ver utente de outro hospital.
- **Evidência MedTrack**: `UtenteController::findByProcesso`.

### 1.2 Filtros na listagem de registos cirúrgicos
- **Criar/Modificar** `packages/schemas/src/registo.ts`: `registoFiltrosSchema` = `{ search?, dataInicio?, dataFim?, diagnosticoId?, procedimentoId?, funcaoCirurgiaoId?, tipoDeCirurgiaIds?: string[] }` (todos opcionais/nullable). Export em `packages/schemas/src/index.ts`. **Rebuild schemas.**
- **Modificar** `apps/medfolio-api/src/registos-cirurgicos/registos-cirurgicos.service.ts`: `list(hospitalId, userId, filtros)` — WHERE dinâmico (mantém `hospitalId`+`userId`+`deletedAt`); `search` em nome/processo do utente; datas em `dataCirurgia`; `diagnosticoId`/`procedimentoId`/`funcaoCirurgiaoId` via `inArray` de registos com cirurgia correspondente (subquery/`exists`); `tipoDeCirurgiaIds` via `inArray`.
- **Modificar** `apps/medfolio-api/src/registos-cirurgicos/registos-cirurgicos.controller.ts`: `@Get()` lê `@Query()` validado por `registoFiltrosSchema`.
- **Modificar** `apps/medfolio/src/lib/api.ts`: `getRegistos(filtros?)` monta querystring.
- **Modificar** `apps/medfolio/src/pages/RegistosCirurgicos.tsx`: barra de filtros (InputText search, 2× Calendar, Dropdowns de diagnóstico/procedimento/função, MultiSelect de tipo). Persistir no cliente (URL params via `useSearchParams` ou `localStorage`).
- **Edge**: array/valor vazio ignorado; datas inválidas ignoradas.
- **Evidência MedTrack**: `RegistoCirurgicoController::index` (bloco `$filters` + `whereHas`).

---

## VAGA 2 — Portfólio completo + uploads (P1)

### 2.1 Migração de campos (BD)
- **Modificar** `packages/db/src/schema/portfolio.ts`:
  - `atividadesCientificas`: adicionar `descricao text`, `revistaConferencia varchar(255)`, `localizacao varchar(255)`, `categoria varchar(50)`, `autores varchar(1000)`, `doi varchar(255)`, `isbn varchar(50)`, `link varchar(500)`, `observacoes text`, `ficheiroOriginalName varchar(255)`, `ficheiroSize integer`.
  - `formacoes`: adicionar `descricao text`, `entidadeOrganizadora varchar(255)`, `localizacao varchar(255)`, `categoria varchar(50)`, `tipoParticipacao varchar(50)` (ou enum novo em `enums.ts`), `temaApresentacao varchar(500)`, `observacoes text`, `certificadoOriginalName varchar(255)`, `certificadoSize integer`.
  - *(opcional)* `enums.ts`: `tipoParticipacaoEnum = ['participante','orador','organizador','moderador']`.
- **Comandos**: `pnpm db:generate` → `pnpm db:migrate:local` → `pnpm --filter @nexo-centro/db build`.

### 2.2 Contrato Zod
- **Modificar** `packages/schemas/src/atividade-cientifica.ts` e `formacao.ts`: acrescentar os campos aos `*Schema`, `create*Schema`, `update*Schema` (limites: descricao/observacoes max 2000; link `.url()`; categoria `.enum([...])`; fatorImpacto já existe). **Rebuild schemas.**

### 2.3 API — campos + upload/download
- **Dep nova**: upload multipart — `@nestjs/platform-express` já está; adicionar `@types/multer` (dev) no container. Definir storage local (`STORAGE_DIR`, default `./storage`) + validar em `env.validation.ts`.
- **Modificar** `apps/medfolio-api/src/atividades-cientificas/atividades-cientificas.{service,controller}.ts` e `formacoes/*`:
  - Persistir novos campos no create/update.
  - `@Post()` / `@Patch(':id')` com `@UseInterceptors(FileInterceptor('ficheiro'|'certificado'))` — validar mimes (`pdf,doc,docx,ppt,pptx,jpg,jpeg,png`) e `≤10MB`; guardar path/originalName/size; ao substituir/eliminar, apagar ficheiro antigo; flag `removerFicheiro`/`removerCertificado` no update.
  - `@Get(':id/download')` → stream do ficheiro com `Content-Disposition` (originalName); 404 se não existir.
- **Nota tenancy**: portfólio é por-**utilizador** (`userId`), não por hospital — não usar `HospitalScopeGuard` aqui (segue o padrão atual destes módulos).
- **Evidência MedTrack**: `AtividadeCientificaController::{store,update,destroy,download}`, `FormacaoController::*`, `Store/UpdateAtividadeRequest`, `Store/UpdateFormacaoRequest`.

### 2.4 Frontend — formulários + upload
- **Modificar** `apps/medfolio/src/lib/api.ts`: alargar interfaces `AtividadeCientifica`/`Formacao` e bodies; usar `FormData` no create/update quando há ficheiro; `downloadAtividade(id)`/`downloadFormacao(id)`.
- **Modificar** `apps/medfolio/src/pages/AtividadeCientifica.tsx` e `Formacoes.tsx`: campos novos + `FileUpload` (PrimeReact) + botão download + toggle "remover ficheiro"; filtros (tipo/ano/categoria) em Formações.

---

## VAGA 3 — Exportações (P1/P2)

### 3.1 Export de registos → Excel/CSV
- **Dep nova**: `exceljs` (ou gerar CSV sem dep). Instalar no container.
- **Criar** `apps/medfolio-api/src/registos-cirurgicos/registos-cirurgicos.export.ts` (helper que monta o workbook) *ou* método no service.
- **Modificar** `registos-cirurgicos.controller.ts`: `@Get('export')` (antes de `:id`) → stream `.xlsx` com colunas `Data, Idade, Sexo, Processo, Hospital, Especialidade, Tipo Cirurgia, Tipo Abordagem, Ambulatório, Cirurgias(agregado), Observações`; respeita filtros ativos e scope `(hospitalId,userId)`.
- **Modificar** `apps/medfolio/src/lib/api.ts` + `RegistosCirurgicos.tsx`: botão "Exportar" (`window.open`/fetch→blob→download).
- **Edge**: sem dados → só cabeçalhos; nomes null → "N/A".
- **Evidência**: `app/Exports/RegistosCirurgicosExport.php`.

### 3.2 Export de atividades e formações → Excel
- Igual a 3.1 em `atividades-cientificas` e `formacoes` (`@Get('export')` + colunas de `AtividadesCientificasExport`/`FormacoesExport`).

---

## VAGA 4 — Área de administração (P1)

> `admin_users` e `hospital_user.approvedBy` já existem no schema; falta o módulo.

### 4.1 Auth admin
- **Criar** `apps/medfolio-api/src/admin/admin-auth.{service,controller}.ts` + guard `admin.guard.ts` (verifica JWT de admin; super-admin = `hospitalId null`, admin de hospital = restrito). Cookie/token separado (ex.: `medfolio_admin_session`, novo `typ: 'admin_session'`).
- **Criar** `packages/schemas/src/admin.ts`: schemas de login admin, gestão de utilizador, aprovação de adesão. Export no index. Rebuild.
- **Modificar** `app.module.ts`: registar `AdminModule`.
- **Evidência**: `app/Http/Controllers/Admin/AuthController`, `AdminMiddleware`, `Gate::before`.

### 4.2 Gestão de utilizadores + aprovação de adesões
- **Criar** `apps/medfolio-api/src/admin/admin-users.{service,controller}.ts`: listar/ver/editar utilizadores, **ativar/desativar** (`is_active`), listar pedidos `hospital_user` pending e **aprovar/recusar** (aprovar → `status:'approved'`, `approvedByUserId`, `approvedAt`; recusar → soft-delete da linha).
- **Criar** `apps/medfolio-api/src/admin/admin-dashboard.{service,controller}.ts`: métricas globais (total users, ativos, total registos, últimos registos).
- **Edge**: super-admin vê tudo; admin de hospital só o seu; admin não se auto-desativa; aprovar já-aprovado = no-op.
- **Evidência**: `Admin/UserController`, `Admin/DashboardController`, `hospital_user`.

### 4.3 Frontend admin
- **Criar** `apps/medfolio/src/pages/admin/{Login,Dashboard,Users,Requests}.tsx` + rotas próprias em `App.tsx` (fora do `AppShell` normal ou num shell admin) + entradas no cliente `api.ts`.

---

## VAGA 5 — UX do registo: wizard + QuickAdd (P2)

### 5.1 Wizard multi-passo
- **Modificar/Refazer** `apps/medfolio/src/pages/RegistosCirurgicos.tsx` (ou novo `RegistoWizard.tsx`): passos **Utente → Registo → Diagnósticos → Intervenções → Revisão**, barra de progresso, validação por passo (`canAdvance`), submeter tudo num `createRegisto`/`updateRegisto`.
- **Depende de**: 1.1 (lookup + criar utente inline), 5.2 (QuickAdd).
- **Edge**: ≥1 diagnóstico; cada diagnóstico ≥1 procedimento+função; só submeter no último passo.
- **Evidência**: `resources/js/pages/registos-cirurgicos/create.tsx`.

### 5.2 QuickAdd inline
- **Criar** `apps/medfolio/src/components/QuickAddDialogs.tsx`: diálogos para criar diagnóstico/procedimento/especialidade/zona sem sair do form; usa endpoints CRUD já existentes; devolve o id e seleciona-o.
- **Evidência**: `resources/js/components/quick-add/QuickAddDialogs.tsx`.

### 5.3 Criar utente inline no fluxo
- **Modificar** wizard passo 1: procurar por processo → se existe, pré-preencher; se não, criar (`createUtente`) e usar. Alternativa: aceitar utente embebido no payload de `POST /registos-cirurgicos` (nova validação no service).

---

## VAGA 6 — Catálogos de gestão + extras (P2)

### 6.1 CRUD de Tipos de Cirurgia / Tipos de Abordagem / Funções do Cirurgião
- **Criar** módulos `apps/medfolio-api/src/tipos-de-cirurgia/*`, `tipos-de-abordagem/*`, `funcoes-cirurgiao/*` (CRUD scoped por hospital, unicidade de nome, `assertNotReferenced` antes de delete). Tipo de Abordagem só editável por admin (usar guard admin da Vaga 4).
- **Criar** schemas Zod correspondentes + `api.ts` + páginas frontend + entradas em `nav.config.ts`.
- **Evidência**: `TipoDeCirurgiaController`, `TipoDeAbordagemController` (`ensureAdmin`), `FuncaoCirurgiaoController`.

### 6.2 Reordenar zonas anatómicas
- **Modificar** `zonas-anatomicas.{service,controller}.ts`: `@Patch('reorder')` recebe `[{id,ordem}]` (schema Zod novo), atualiza `ordem` (ids do hospital ativo).
- **Modificar** `ZonasAnatomicas.tsx`: UI de reordenar (setas ↑/↓ ou drag).
- **Evidência**: `ZonaAnatomicaController::reorder`.

### 6.3 Duplicar registo
- **Modificar** `RegistosCirurgicos.tsx`: ação "Duplicar" na listagem → abre wizard pré-preenchido a partir de `getRegisto(id)`, limpando utente + data.
- **Evidência**: `RegistoCirurgicoController::create` (`duplicate_from`).

### 6.4 Enriquecer "Cirurgias por Área"
- **Modificar** `cirurgias-por-area.service.ts` + `packages/schemas/src/cirurgias-por-area.ts`: acrescentar eixos electivo/urgente e cirurgião/ajudante. **Preferir flags/dados** em vez de comparar nomes (evitar INC-03).
- **Modificar** `CirurgiasPorArea.tsx`: colunas novas.

---

## VAGA 7 — Nice-to-have (P3)

- **Logs de atividade admin**: nova tabela `admin_activity_logs` (schema + migração) + serviço `AdminLogService` + página. Evidência: `AdminActivityLog`/`AdminLogService`.
- **Contagem de uso** em diagnósticos/procedimentos: subquery `count(distinct registo_cirurgico_id)` no `list` + coluna na tabela. Evidência: `DiagnosticoController::index`.
- **Export de currículo JSON** (admin): `@Get('curriculos/:id/export/json')`. Evidência: `Admin/CurriculumController::exportJson`.
- **Paginação server-side** nas listagens (page/perPage=15). Evidência: `->paginate(15)` em todos os controllers.
- **Alinhar enums** de tipo de atividade/formação/participação (decisão de dados).
- **Auto-registo + verificação de email** (decisão de produto): endpoint de registo + fluxo de verificação (SMTP).

---

## Ordem recomendada & pontos de verificação

1. **Vaga 0** (rápida, segurança) → build API.
2. **Vaga 1** (lookup + filtros) → build schemas + API + frontend.
3. **Vaga 2** (portfólio + uploads) → migração + builds.
4. **Vaga 3** (exports).
5. **Vaga 4** (admin) — maior; pode correr em paralelo com 5/6.
6. **Vaga 5** (wizard/QuickAdd) — depende de 1.1.
7. **Vaga 6**, depois **Vaga 7**.

Após cada vaga: `pnpm -r typecheck && pnpm --filter medfolio-api build && pnpm --filter medfolio build`, e testar no browser (login → filtros → criar registo → export).

## Resumo de ficheiros novos (por criar)

**API**: `common/throttler.module.ts`(opc); `admin/` (auth+users+dashboard+guard+module, ~6 ficheiros); `tipos-de-cirurgia/`, `tipos-de-abordagem/`, `funcoes-cirurgiao/` (3 módulos × 3); export helpers em registos/atividades/formacoes.
**Schemas**: `admin.ts`, `tipo-de-cirurgia.ts`, `tipo-de-abordagem.ts`, `funcao-cirurgiao.ts`, `registo-reorder`/filtros (em `registo.ts`/`zona-anatomica.ts`).
**Frontend**: `components/QuickAddDialogs.tsx`, `pages/admin/*` (4), `pages/TiposDeCirurgia.tsx`/`TiposDeAbordagem.tsx`/`FuncoesCirurgiao.tsx` (se expostos no menu).

## Ficheiros mais tocados (por modificar)

`app.module.ts`, `main.ts`, `auth.controller.ts`, `env.validation.ts`, `packages/db/src/schema/{portfolio,enums,reference}.ts`, `packages/schemas/src/{registo,atividade-cientifica,formacao,index}.ts`, `utentes.{service,controller}.ts`, `registos-cirurgicos.{service,controller}.ts`, `atividades-cientificas.*`, `formacoes.*`, `cirurgias-por-area.*`, `zonas-anatomicas.*`, `apps/medfolio/src/lib/api.ts`, `apps/medfolio/src/App.tsx`, `apps/medfolio/src/shell/nav.config.ts`, e as páginas correspondentes.
