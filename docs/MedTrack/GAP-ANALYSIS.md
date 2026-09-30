# MedTrack → MedFolio — Gap Analysis Técnico

> **Objetivo**: checklist de paridade funcional entre o **MedTrack** (referência, Laravel + Inertia/React, scope por `user_id`) e o **MedFolio** (este projeto, NestJS + React/Vite, multi-tenant por `hospital_id`).
> **Método**: leitura de código-fonte de ambos (rotas/controllers/requests/policies/models/migrations/exports/frontend do MedTrack; controllers/services/schema Drizzle/schemas Zod/páginas do MedFolio).
> **Convenção de confiança**: `[C]` confirmado pelo código · `[I]` inferido · `[N]` não determinável.
> **Regra do dono**: manter o que já está construído. O modelo multi-tenant por hospital do MedFolio é **superior** ao scope-por-utilizador do MedTrack e **não deve ser regredido**. O foco é **funcionalidades**, não arquitetura nem nomes.

---

## 0. Diferença arquitetural-chave (ler antes de tudo)

| Dimensão | MedTrack | MedFolio | Implicação |
|---|---|---|---|
| Tenancy | Tudo pertence a um `user_id` (trait `BelongsToUser` + `UserScope` global) `[C]` | Tudo pertence a um `hospital_id`; utilizadores são membros com aprovação (`hospital_user` pending/approved) `[C]` | Ao portar features, o scope é sempre `(hospitalId, userId)` — nunca copiar o `where user_id` do MedTrack. |
| Utente | `idade` (int) na tabela; `processo` int único **por utilizador** `[C]` | `dataNascimento` (date) na tabela + `idadeCirurgia` no registo; `processo` varchar único **por hospital** `[C]` | Divergência intencional. Mantida. |
| Complicações | Coluna literal `clavien-dindo` + accessor `[C]` | Enum limpo `clavien_dindo` com valor explícito `sem_complicacoes` `[C]` | Divergência intencional. Mantida. |
| Segurança 2FA | Fortify (secret em claro na BD) `[C]` | AES-256-GCM at-rest + recovery codes com argon2 `[C]` | MedFolio superior. Manter. |
| Soft-delete | Não (hard delete) `[C]` | `deleted_at` em todo o lado + guardas IDOR cross-tenant `[C]` | MedFolio superior. Manter. |
| Admin | `admin_users` + guard `admin` + Spatie roles `[C]` | Tabela `admin_users` **existe no schema** mas **sem módulo/endpoints** `[C]` | Grande lacuna funcional (ver P1). |

---

## 1. Tabela de paridade

Estados: **Implementado** · **Parcial** · **Em falta** · **Diferente (intencional)** · **N/A**

### 1.1 Autenticação & Sessão

| Área | Funcionalidade/Regra | MedTrack | Meu projeto | Estado | O que falta |
|---|---|---|---|---|---|
| Auth | Login email+password | Fortify `[C]` | `POST /auth/login` `[C]` | Implementado | — |
| Auth | 2FA (setup/confirm/challenge/disable) | Fortify TOTP + recovery `[C]` | `2fa/setup·confirm·skip·disable` + `login/2fa` `[C]` | Implementado (superior) | — |
| Auth | Recuperar password (forgot/reset) | Fortify `[C]` | `forgot-password`/`reset-password` (token hash) `[C]` | Implementado | — |
| Auth | **Rate limiting** login + 2FA (5/min) | `RateLimiter` login+two-factor `[C]` | Nenhum throttle no código `[C]` | **Em falta** | Adicionar throttling (regressão de segurança). |
| Auth | **Auto-registo (sign-up)** | `Features::registration()` + `CreateNewUser` `[C]` | Sem endpoint de registo `[C]` | **Em falta / Diferente** | Decidir: admin cria contas ou self-signup? |
| Auth | **Verificação de email** | `Features::emailVerification` + middleware `verified` `[C]` | Só coluna `emailVerifiedAt` (reset ao mudar email); sem fluxo `[C]` | **Em falta** | Fluxo de verificação se registo for aberto. |
| Auth | Conta inativa bloqueia login | Middleware `CheckUserActive` `[C]` | `isActive` na BD; login verifica? confirmar em `auth.service` `[I]` | Parcial | Garantir 403/logout se `is_active=false`. |
| Auth | Prompt de setup 2FA pós-login (saltável) | Não `[C]` | `twoFactorPromptedAt` + `2fa/skip` `[C]` | Implementado (extra) | — |

### 1.2 Multi-tenant / Hospital

| Área | Funcionalidade/Regra | MedTrack | Meu projeto | Estado | O que falta |
|---|---|---|---|---|---|
| Hospital | Seleção de hospital ativo | N/A (user-scope) `[C]` | `SelectHospitalPage` + `HospitalScopeGuard` `[C]` | Implementado (extra) | — |
| Hospital | Pedido de adesão a hospital | N/A | `POST /hospitals/requests` (pending) `[C]` | Parcial | Falta **aprovação** do pedido. |
| Hospital | **Aprovar/recusar adesão** | N/A | `hospital_user.approvedBy` existe; **sem endpoint** `[C]` | **Em falta** | Endpoint admin/gestor para aprovar (ver P1). |

### 1.3 Registo Cirúrgico (núcleo)

| Área | Funcionalidade/Regra | MedTrack | Meu projeto | Estado | O que falta |
|---|---|---|---|---|---|
| Registo | CRUD registo + cirurgias (transação) | `store/update` em transação, replace de cirurgias `[C]` | `create/update` em transação, replace de cirurgias `[C]` | Implementado | — |
| Registo | Cada registo ≥ 1 diagnóstico e cada diag. ≥ 1 procedimento | Requests `min:1` aninhado `[C]` | `cirurgias.min(1)` (lista plana diag×proc) `[C]` | Parcial/Diferente | MedFolio modela `cirurgia = (diag,proc)`; falta agrupar por diagnóstico no UI. |
| Registo | **Wizard multi-passo (Utente→Registo→Diag→Interv→Revisão)** | `create.tsx` 5 passos + `canAdvance` `[C]` | Dialog único plano (PrimeReact) `[C]` | **Em falta** | Wizard passo-a-passo com validação por passo (ver P2). |
| Registo | **Procurar utente por nº processo (auto-preencher/criar)** | `api/utentes/processo/{n}` + `searchUtente()` `[C]` | Utente tem de pré-existir (dropdown) `[C]` | **Em falta** | Endpoint lookup + criar-utente-inline no fluxo (ver P1). |
| Registo | **QuickAdd inline** (diag/proc/especialidade/zona) | `QuickAddDialogs.tsx` + flash `new_*_id` `[C]` | Não `[C]` | **Em falta** | Diálogos de criação rápida dentro do formulário (ver P2). |
| Registo | **Filtros na listagem** (pesquisa, datas, diag, proc, função, tipo) | `index()` com filtros + sessão `[C]` | Listagem sem filtros `[C]` | **Em falta** | Query params + UI de filtro (ver P1). |
| Registo | **Filtros persistidos em sessão** | `session('registos_filtros')` `[C]` | Não (API stateless) `[C]` | **Em falta / Diferente** | Persistir no cliente (URL/localStorage). |
| Registo | **Duplicar registo** | `?duplicate_from=` limpa utente+data `[C]` | Não `[C]` | **Em falta** | Pré-preencher form a partir de outro (ver P2). |
| Registo | Idade na cirurgia | `utente.idade` (por registo, no utente) `[C]` | `idadeCirurgia` no registo `[C]` | Implementado (melhor) | — |
| Registo | Ambulatório (Sim/Não) | `ambulatorio` boolean `[C]` | `ambulatorio` boolean `[C]` | Implementado | — |
| Registo | Anatomia patológica por cirurgia | `anatomia_patologica` `[C]` | `anatomiaPatologica` `[C]` | Implementado | — |
| Registo | Validação de refs pertencem ao tenant | `Rule::exists...where(user_id)` `[C]` | `assertRefs`/`assertCatalog` por hospital (IDOR fix SEC-02) `[C]` | Implementado (superior) | — |

### 1.4 Catálogos / Referências

| Área | Funcionalidade/Regra | MedTrack | Meu projeto | Estado | O que falta |
|---|---|---|---|---|---|
| Utentes | CRUD + pesquisa nome/processo | `index` search + paginação `[C]` | CRUD + filtro global (nome/processo) `[C]` | Implementado | Paginação server-side (MedFolio traz tudo). |
| Especialidades | CRUD + unicidade | CRUD, unique por user `[C]` | CRUD, unique por hospital `[C]` | Implementado | — |
| Zonas Anatómicas | CRUD | CRUD `[C]` | CRUD `[C]` | Implementado | — |
| Zonas Anatómicas | **Reordenar (ordem/drag)** | `POST /zona-anatomicas/reorder` `[C]` | Coluna `ordem` existe; **sem endpoint reorder** `[C]` | **Em falta** | Endpoint + UI de reordenação (ver P2). |
| Diagnósticos | CRUD + zona + tipo(benigno/maligno) | CRUD `[C]` | CRUD `[C]` | Implementado | — |
| Diagnósticos | **Contagem de uso na listagem** | `registos_cirurgicos_count` subquery `[C]` | Não `[I]` | **Em falta** | Coluna de contagem (ver P3). |
| Procedimentos | CRUD + especialidade + contagem uso | CRUD + count `[C]` | CRUD (sem count) `[C]` | Parcial | Contagem de uso. |
| Tipos de Cirurgia | **CRUD gestão** | `Route::resource` completo `[C]` | Só leitura via `/catalogos/registo` `[C]` | **Em falta** | CRUD (ver P2). |
| Tipos de Abordagem | **CRUD gestão (admin-only)** | Resource split: leitura todos, escrita admin `[C]` | Só leitura via catálogos `[C]` | **Em falta** | CRUD restrito (ver P2). |
| Funções do Cirurgião | **CRUD gestão** | `Route::resource` + unique nome `[C]` | Só leitura via catálogos `[C]` | **Em falta** | CRUD (ver P2). |

### 1.5 Portfolio (Atividade Científica & Formações)

| Área | Funcionalidade/Regra | MedTrack | Meu projeto | Estado | O que falta |
|---|---|---|---|---|---|
| Atividade Científica | CRUD | CRUD completo `[C]` | CRUD `[C]` | Parcial | Campos reduzidos (ver abaixo). |
| Atividade Científica | **Campos completos** | titulo, descricao, tipo, data, revista_conferencia, localizacao, categoria, autores, autor_principal, posicao_autor, doi, isbn, link, fator_impacto, observacoes `[C]` | só titulo, tipo, data, autorPrincipal, posicaoAutor, fatorImpacto `[C]` | **Parcial** | Adicionar campos em falta (ver P1). |
| Atividade Científica | **Anexo de ficheiro (upload/download)** | store local + download + mimes/max 10MB `[C]` | Só coluna `ficheiroPath` (sem upload/download) `[C]` | **Em falta** | Upload+download+validação (ver P1). |
| Formações | CRUD | CRUD completo `[C]` | CRUD `[C]` | Parcial | Campos reduzidos. |
| Formações | **Campos completos** | + entidade_organizadora, localizacao, categoria, tipo_participacao, tema_apresentacao, descricao, observacoes `[C]` | só titulo, tipo, dataInicio, dataFim, duracaoHoras, creditos `[C]` | **Parcial** | Adicionar campos (ver P1). |
| Formações | **Certificado (upload/download)** | store local + download `[C]` | Só coluna `certificadoPath` `[C]` | **Em falta** | Upload+download. |
| Formações | data_fim ≥ data_inicio | Request `after_or_equal` `[C]` | Zod `.refine` + CHECK BD `[C]` | Implementado (superior) | — |
| Formações | **Filtros (tipo/ano/categoria)** | `index` filled filters `[C]` | Filtro global cliente `[I]` | Parcial | Filtros por tipo/ano/categoria. |
| Enums tipo | Atividade: 9 valores; Formação: 8; Participação: 4 | `[C]` | Atividade: 5; Formação: 6; sem participação `[C]` | **Diferente** | Alinhar enums se paridade de dados for requisito. |

### 1.6 Dashboard & Relatórios

| Área | Funcionalidade/Regra | MedTrack | Meu projeto | Estado | O que falta |
|---|---|---|---|---|---|
| Dashboard | Totais (registos, utentes, cirurgias/mês, complicações, publicações, formações, horas, créditos) | `dashboard` closure `[C]` | `DashboardService.summary` `[C]` | Implementado | — |
| Dashboard | Registos recentes | top 5 `[C]` | top 5 `[C]` | Implementado | — |
| Dashboard | **Breakdown principal/ajudante + pequena cirurgia** | ~10 métricas por comparação de nome de função `[C]` | Removido de propósito (INC-03: frágil) `[C]` | **Diferente (intencional)** | Se necessário, refazer por FK de função, não por nome. |
| Cirurgias por Área | Relatório Zona→Tipo→(Diag×Proc) | `cirurgiasPorArea()` + electivo/urgente/formativa `[C]` | `CirurgiasPorAreaService` Zona→Tipo→linhas `[C]` | Parcial | Falta eixo electivo/urgente e cir/ajud/formativa. |

### 1.7 Admin (área inteira)

| Área | Funcionalidade/Regra | MedTrack | Meu projeto | Estado | O que falta |
|---|---|---|---|---|---|
| Admin | Login admin (guard separado) | `Admin/AuthController` `[C]` | Tabela `admin_users` sem endpoints `[C]` | **Em falta** | Auth admin (ver P1). |
| Admin | Dashboard admin (métricas globais) | `Admin/DashboardController` `[C]` | Não `[C]` | **Em falta** | (ver P1) |
| Admin | Gestão de utilizadores (list/create/edit/ativar/eliminar) | `Admin/UserController` `[C]` | Não `[C]` | **Em falta** | (ver P1) |
| Admin | **Logs de atividade** | `AdminActivityLog` + `AdminLogService` `[C]` | Não (sem tabela) `[C]` | **Em falta** | (ver P2) |
| Admin | Visualizar currículos + export JSON | `Admin/CurriculumController` `[C]` | Não `[C]` | **Em falta** | (ver P3) |

### 1.8 Exportações

| Área | Funcionalidade/Regra | MedTrack | Meu projeto | Estado | O que falta |
|---|---|---|---|---|---|
| Export | Registos cirúrgicos → Excel | `RegistosCirurgicosExport` `[C]` | Não `[C]` | **Em falta** | (ver P1) |
| Export | Atividades científicas → Excel | `AtividadesCientificasExport` `[C]` | Não `[C]` | **Em falta** | (ver P2) |
| Export | Formações → Excel | `FormacoesExport` `[C]` | Não `[C]` | **Em falta** | (ver P2) |

### 1.9 Perfil

| Área | Funcionalidade/Regra | MedTrack | Meu projeto | Estado | O que falta |
|---|---|---|---|---|---|
| Perfil | Editar perfil (nome/email/especialidade) | `ProfileController` `[C]` | `PATCH /profile` `[C]` | Implementado | — |
| Perfil | Alterar password (current_password) | `PasswordController` `[C]` | `POST /profile/change-password` `[C]` | Implementado | — |
| Perfil | Eliminar conta (com password) | `destroy` `[C]` | `DELETE /profile` `[C]` | Implementado | — |
| Perfil | Aparência (tema claro/escuro) | `appearance` cookie `[C]` | `useTheme` `[C]` | Implementado | — |

---

## 2. Checklist de implementação priorizada

Prioridade: **P0** segurança/correção · **P1** paridade funcional crítica · **P2** paridade de UX · **P3** nice-to-have.

### P0 — Segurança / correção

- [ ] **Rate limiting no login e 2FA**
  - **O quê**: limitar tentativas de `login`, `login/2fa`, `forgot-password`, `reset-password`.
  - **Onde**: `apps/medfolio-api/src/auth/*` (usar `@nestjs/throttler` ou guard próprio por IP+email).
  - **Comportamento**: ~5 tentativas/min → 429.
  - **Validações/edge**: chave `email|ip`; não vazar se email existe; reset após sucesso.
  - **Dependências**: nenhuma.
  - **Evidência MedTrack**: `app/Providers/FortifyServiceProvider.php::configureRateLimiting()` (limiters `login`, `two-factor`), `routes/settings.php` (`throttle:6,1` no update de password).

- [ ] **Bloquear login de conta inativa** (confirmar/garantir)
  - **Onde**: `auth.service.ts::login`.
  - **Comportamento**: `is_active=false` → 403 com mensagem "conta inativa".
  - **Evidência**: `app/Http/Middleware/CheckUserActive.php`.

### P1 — Paridade funcional crítica

- [ ] **Lookup de utente por nº de processo**
  - **O quê**: endpoint que devolve o utente do hospital ativo dado um processo (para auto-preencher).
  - **Onde**: `utentes.controller.ts` → `GET /utentes/processo/:processo`; `utentes.service.ts`.
  - **Comportamento**: devolve utente ou `null`; scope estrito por `hospitalId`.
  - **Validações/edge**: processo inexistente → `{utente:null}` (200, não 404); processo de outro hospital nunca visível.
  - **Dependências**: usado pelo wizard (P2) e criar-utente-inline.
  - **Evidência**: `UtenteController::findByProcesso` + `create.tsx::searchUtente()`.

- [ ] **Criar utente inline no fluxo de registo** + criar registo com utente novo numa transação
  - **Onde**: fluxo do registo (`RegistosCirurgicos.tsx` / futuro wizard) + possivelmente aceitar `utente` embebido no payload de `POST /registos-cirurgicos`.
  - **Comportamento**: se processo não existe, permitir criar utente e usar no registo sem sair do fluxo.
  - **Validações**: processo único por hospital (`utentes_hospital_id_processo_uq`); sexo/idade obrigatórios como no MedTrack.
  - **Edge**: corrida — dois registos com mesmo processo → tratar erro de unique (já mapeado em `utentes.service`).
  - **Evidência**: `RegistoCirurgicoController::store` (bloco `if (!empty($utenteData['id'])) update else create`).

- [ ] **Filtros na listagem de registos cirúrgicos**
  - **O quê**: pesquisa (nome/processo/hospital/especialidade), intervalo de datas, `diagnostico_id`, `procedimento_id`, `funcao_cirurgiao_id`, `tipo_de_cirurgia_ids[]`.
  - **Onde**: `registos-cirurgicos.controller.ts` (query params) + `service.list` (WHERE dinâmico) + UI de filtro em `RegistosCirurgicos.tsx`. Novo schema Zod de filtros em `packages/schemas`.
  - **Comportamento**: filtros combináveis (AND); vazio = tudo.
  - **Edge**: datas inválidas ignoradas; array vazio ignorado; manter scope `(hospitalId,userId)`.
  - **Dependências**: catálogos (já existem).
  - **Evidência**: `RegistoCirurgicoController::index` (bloco de `$filters` + `whereHas`).
  - **Nota**: persistir filtros no cliente (URL/localStorage), não em sessão de servidor.

- [ ] **Portfolio: campos completos + upload de ficheiro**
  - **O quê (Atividade)**: adicionar `descricao, revistaConferencia, localizacao, categoria, autores, doi, isbn, link, observacoes, ficheiroOriginalName, ficheiroSize`. **(Formação)**: `entidadeOrganizadora, localizacao, categoria, tipoParticipacao, temaApresentacao, descricao, observacoes`.
  - **Onde**: migração Drizzle em `packages/db/src/schema/portfolio.ts`; schemas Zod em `packages/schemas/src/{atividade-cientifica,formacao}.ts`; serviços/controllers; páginas frontend.
  - **Upload**: endpoint multipart + storage (local/S3) + `GET .../:id/download`; validar mimes (pdf/doc/docx/ppt/pptx/jpg/png) e ≤10MB; apagar ficheiro ao substituir/eliminar; flag `removerFicheiro` no update.
  - **Edge**: eliminar registo apaga ficheiro; download de registo sem ficheiro → 404; scope por `userId`.
  - **Evidência**: `AtividadeCientificaController::{store,update,destroy,download}`, `Store/UpdateAtividadeRequest`, idem Formação; `app/Exports/*` (colunas esperadas).

- [ ] **Exportação de registos cirúrgicos → Excel/CSV**
  - **Onde**: `GET /registos-cirurgicos/export` + serviço de export (biblioteca xlsx no Nest, ou gerar CSV).
  - **Comportamento**: colunas `Data, Idade, Sexo, Processo, Hospital, Especialidade, Tipo Cirurgia, Tipo Abordagem, Ambulatório, Cirurgias(agregado), Observações`; scope `(hospitalId,userId)`; respeitar filtros ativos.
  - **Edge**: sem dados → ficheiro só com cabeçalhos; nomes null → "N/A".
  - **Evidência**: `app/Exports/RegistosCirurgicosExport.php` (`headings()`, `map()`).

- [ ] **Área de administração (mínima)**: auth admin + gestão de utilizadores + aprovação de adesões a hospital
  - **O quê**: login admin (usar `admin_users` já existente), listar/ver/editar utilizadores, **ativar/desativar** (`is_active`), aprovar/recusar pedidos `hospital_user` (pending→approved), dashboard com métricas globais.
  - **Onde**: novo módulo `apps/medfolio-api/src/admin/*` + guard de admin (super-admin = `hospitalId null`; admin de hospital = restrito ao seu hospital); páginas frontend admin.
  - **Comportamento**: super-admin vê tudo; admin de hospital só o seu hospital.
  - **Edge**: admin não se auto-desativa; aprovar pedido já aprovado é no-op; recusar = soft-delete do `hospital_user` (o índice único parcial permite novo pedido).
  - **Dependências**: `admin_users`, `hospital_user` (ambos já no schema).
  - **Evidência**: `app/Http/Controllers/Admin/*`, `AdminMiddleware`, `Gate::before` (super-admin), `hospital_user.approvedByUserId`.

### P2 — Paridade de UX

- [ ] **Wizard multi-passo do registo cirúrgico** (Utente → Registo → Diagnósticos → Intervenções → Revisão)
  - **Onde**: refazer `RegistosCirurgicos.tsx` como wizard (ou novo componente), mantendo o payload `CreateRegisto`.
  - **Comportamento**: validação por passo (`canAdvance`), barra de progresso, revisão final, submeter tudo numa chamada.
  - **Edge**: não submeter fora do último passo; ≥1 diagnóstico e cada um com ≥1 procedimento+função antes de avançar.
  - **Dependências**: lookup de utente (P1), QuickAdd (abaixo).
  - **Evidência**: `resources/js/pages/registos-cirurgicos/create.tsx` (`stepNames`, `canAdvance`, `handleSubmit`).

- [ ] **QuickAdd inline** (diagnóstico, procedimento, especialidade, zona anatómica)
  - **Onde**: componente de diálogo reutilizável no frontend; usar os endpoints CRUD existentes; devolver o id criado e selecioná-lo.
  - **Comportamento**: criar sem sair do formulário, adicionar à dropdown e selecionar.
  - **Edge**: nome duplicado → mostrar erro no diálogo; `zona anatómica` por nome pode usar `firstOrCreate`.
  - **Evidência**: `resources/js/components/quick-add/QuickAddDialogs.tsx` + flash `new_*_id` nos controllers.

- [ ] **CRUD de catálogos de gestão**: Tipos de Cirurgia, Tipos de Abordagem (admin), Funções do Cirurgião
  - **Onde**: novos módulos/endpoints + páginas; ou expor CRUD nas páginas existentes.
  - **Comportamento**: create/edit/delete com unicidade de nome (por hospital ou global).
  - **Edge**: impedir delete se referenciado (padrão `assertNotReferenced` já usado em utentes); Tipo de Abordagem só editável por admin.
  - **Evidência**: `TipoDeCirurgiaController`, `TipoDeAbordagemController` (`ensureAdmin`), `FuncaoCirurgiaoController`.

- [ ] **Reordenar zonas anatómicas**
  - **Onde**: `PATCH /zonas-anatomicas/reorder` (array `{id,ordem}`) + UI drag/setas.
  - **Comportamento**: persistir `ordem`; relatório "cirurgias por área" já ordena por `ordem`.
  - **Edge**: ids de outro hospital ignorados/rejeitados.
  - **Evidência**: `ZonaAnatomicaController::reorder`.

- [ ] **Duplicar registo cirúrgico**
  - **Onde**: ação na listagem → abrir form pré-preenchido (limpar utente + data).
  - **Evidência**: `RegistoCirurgicoController::create` (`duplicate_from`).

- [ ] **Filtros de formações** (tipo/ano/categoria) e **exports de atividades/formações**
  - **Evidência**: `FormacaoController::index`, `AtividadesCientificasExport`, `FormacoesExport`.

- [ ] **Enriquecer "Cirurgias por Área"** com eixos electivo/urgente e cirurgião/ajudante/formativa
  - **Onde**: `cirurgias-por-area.service.ts` + schema.
  - **Comportamento**: contar por (electivo/urgente) × (principal→cir / outro→ajud, formativa se nome contém "formativa"). **Nota**: preferir classificação por dados/flags em vez de comparação de strings (evitar a fragilidade INC-03).
  - **Evidência**: `RegistoCirurgicoController::cirurgiasPorArea`.

### P3 — Nice-to-have

- [ ] **Logs de atividade admin** (tabela + serviço + página) — `AdminActivityLog`/`AdminLogService`.
- [ ] **Contagem de uso** em diagnósticos/procedimentos na listagem — subqueries `registos_cirurgicos_count`.
- [ ] **Visualizador de currículo + export JSON** (admin) — `Admin/CurriculumController::{show,exportJson}`.
- [ ] **Paginação server-side** nas listagens (MedTrack pagina 15/página; MedFolio traz tudo).
- [ ] **Alinhar enums** de tipo de atividade/formação/participação se a paridade de dados for requisito.
- [ ] **Auto-registo + verificação de email** (decisão de produto).

---

## 3. Divergências intencionais — NÃO regredir

Estas diferenças são **melhorias deliberadas** do MedFolio (documentadas nos comentários do código); a paridade **não** exige copiá-las do MedTrack:

1. Scope por **hospital** (multi-tenant) em vez de por utilizador.
2. **Soft-delete** + guardas IDOR cross-tenant (`assertRefs`).
3. 2FA com **cifra at-rest** e recovery codes com **argon2**.
4. `dataNascimento` no utente + `idadeCirurgia` no registo (em vez de `idade` no utente).
5. `clavien_dindo` enum com `sem_complicacoes` explícito (em vez da coluna `clavien-dindo`).
6. Dashboard **sem** as métricas principal/ajudante baseadas em comparação de nomes (INC-03 — eram sempre erradas). Se recriar, usar FK/flag.

---

*Gerado a partir da análise de código de ambos os repositórios. Itens marcados `[I]`/`[N]` devem ser confirmados antes de implementar.*
