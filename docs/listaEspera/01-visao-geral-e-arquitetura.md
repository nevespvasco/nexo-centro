# 01 — Executive Summary, Architecture Overview, Modules & Components

> **Convenção de confiança usada em toda a documentação:**
> - **[CONFIRMADO]** — verificável diretamente no código, com ficheiro/linha.
> - **[INFERIDO]** — dedução a partir de nomes, seeders, UI ou comportamento do framework; não está escrito explicitamente.
> - **[NÃO DETERMINÁVEL]** — não é possível concluir a partir do projeto analisado.

---

## 1. Executive Summary

### 1.1 Propósito do sistema

O projeto é uma aplicação de **gestão de lista de espera cirúrgica hospitalar** para um serviço de Cirurgia (`HSA - Cirurgia`). [CONFIRMADO — `app/Services/ExcelImportService.php:13`, `database/seeders/TeamSeeder.php:16-23`]

O sistema não é a fonte de verdade clínica: os dados dos doentes em lista de espera são **importados periodicamente a partir de um ficheiro Excel** exportado de um sistema hospitalar externo (SIGIC/HIS). [CONFIRMADO — `app/Http/Controllers/ExcelImportController.php`, `app/Services/ExcelImportService.php:16-52`]

Sobre esses dados importados, a aplicação acrescenta uma camada **interna e administrativa** que o sistema hospitalar não tem:

1. **Posicionamento na lista** — cálculo de posição absoluta e por patologia. [CONFIRMADO — `ExcelImportService::updatePositions()`, `updatePositionsByPatologia()`]
2. **Situação interna** do doente, paralela à `situacao` oficial vinda do Excel. [CONFIRMADO — `waiting_list.situacao_interna`, `App\Enum\ResultadoChamada`]
3. **Convocatórias** — a equipa cirúrgica pede à secretaria que contacte o doente; a secretaria regista o resultado. [CONFIRMADO — `WaitingListCallController`]
4. **Agendamento cirúrgico** — blocos operatórios (`slots`) atribuídos a equipas, e agendamentos (`schedules`) de doentes nesses blocos. [CONFIRMADO — `SlotController`, `WaitingListController::storeSchedule`]
5. **Agenda** — visualização semanal/mensal e exportação PDF do plano operatório. [CONFIRMADO — `AgendaController`]
6. **Auditoria de alterações** vindas do Excel. [CONFIRMADO — `waiting_list_history`]

### 1.2 Estado de maturidade

O código está num estado **de desenvolvimento activo e incompleto**. Uma parte significativa da lógica está implementada e funcional, mas existem:

- Controllers gerados por scaffolding e nunca implementados (`ScheduleController`, `WaitingListAdminController`, `WaitingListHistoryController` — todos os métodos vazios). [CONFIRMADO]
- Código morto (`app/Imports/WaitingListImport.php`, `app/Imports/WaitingListChunkImport.php`, `app/Services/ExcelChunkProcessor.php` — nenhum é referenciado fora do próprio ficheiro). [CONFIRMADO — verificado por grep em `app/` e `routes/`]
- Divergências entre esquema de base de dados e código (`equipa_id` vs `team_id`, `contact_result` inexistente em `waiting_list_admin`, `email_verified_at`/`remember_token` inexistentes em `users`). Ver documento **07-inconsistencias-e-bugs.md**.
- Quatro rotas de negócio **fora do grupo `auth`**, publicamente acessíveis. [CONFIRMADO — `routes/web.php:91-100`]

Esta documentação descreve o sistema **tal como está implementado**, não como pretenderia estar.

### 1.3 Stack tecnológica

| Camada | Tecnologia | Fonte |
|---|---|---|
| Backend | PHP 8.2+, Laravel 12 | `composer.json:12,16` |
| Frontend | React 19 + TypeScript, via Inertia.js 2 | `package.json`, `composer.json:15` |
| Build | Vite 6, TailwindCSS 4 | `package.json`, `vite.config.js` |
| Autorização | `spatie/laravel-permission` ^6.25 | `composer.json:18` |
| Import/Export Excel | `spatie/simple-excel` ^3.7 (activo), `maatwebsite/excel` ^3.1 (export + código morto) | `composer.json:17,19` |
| PDF | `barryvdh/laravel-dompdf` ^3.1 | `composer.json:13` |
| Rotas no frontend | `tightenco/ziggy` ^2.4 | `composer.json:20` |
| Notificações UI | `sonner` (toasts) | `package.json` |
| Testes | Pest 3 | `composer.json:29` |
| BD (default) | SQLite; MySQL suportado e **necessário** para posições | `config/database.php:19`, `ExcelImportService:428` |

**Nota crítica de infraestrutura:** o driver de BD por omissão é SQLite (`config/database.php:19`, `.env.example:24`), mas o cálculo de posições em lista (`updatePositions`, `updatePositionsByPatologia`) usa sintaxe `UPDATE ... LEFT JOIN` exclusiva de MySQL e é **explicitamente ignorado em SQLite**. [CONFIRMADO — `ExcelImportService.php:428-430`, `450-452`] Em produção o sistema depende de MySQL. [INFERIDO — `python/import_excel.py:21-26` liga a `mysql.connector`, base `cirurgia_app`]

---

## 2. Architecture Overview

### 2.1 Modelo arquitectural

Aplicação **monolítica Laravel com SPA acoplada via Inertia.js**. Não existe API REST/JSON pública: todos os endpoints devolvem respostas Inertia (páginas React server-driven) ou redirects. [CONFIRMADO — nenhum `routes/api.php`, `bootstrap/app.php:13-17` só regista `web` e `console`]

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 + TypeScript)                                   │
│  resources/js/pages/**  ──  resources/js/components/**             │
│  Estado local por componente (useState). Sem store global.         │
└───────────────┬────────────────────────────────────────────────────┘
                │ Inertia (XHR c/ header X-Inertia; full page no 1º load)
┌───────────────▼────────────────────────────────────────────────────┐
│  Middleware web:                                                   │
│   - sessão (database), CSRF, cookies                               │
│   - HandleInertiaRequests  → partilha auth.user/roles/permissions  │
│   - AddLinkHeadersForPreloadedAssets                               │
│  Middleware nomeados: role | permission | role_or_permission       │
└───────────────┬────────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────────┐
│  Controllers (app/Http/Controllers)                                │
│   Validação inline (Request::validate) + $this->authorize()        │
│   NÃO existe camada de Service para regras de negócio,             │
│   excepto ExcelImportService (import).                             │
└──────┬───────────────────────┬────────────────────┬────────────────┘
       │                       │                    │
┌──────▼──────┐   ┌────────────▼──────────┐   ┌─────▼──────────────┐
│  Policies   │   │  Eloquent Models      │   │ ExcelImportService │
│ (Slot,      │   │  + Query Builder cru  │   │ (DB::table + raw)  │
│  Schedule,  │   │  (DB::table em calls) │   └─────┬──────────────┘
│  WaitingList│   └────────────┬──────────┘         │
│  Team)      │                │                    │
└─────────────┘                ▼                    ▼
                    ┌──────────────────────────────────────┐
                    │  MySQL / SQLite                      │
                    └──────────────────────────────────────┘
```

### 2.2 Padrões e anti-padrões observados

| Aspecto | Observação | Fonte |
|---|---|---|
| **Sem camada Service** | A lógica de negócio vive nos controllers. Única excepção: `ExcelImportService`. | Toda a pasta `app/Http/Controllers` |
| **Sem Repositories** | Acesso a dados directo via Eloquent nos controllers. | idem |
| **Sem Form Requests** (excepto Auth/Settings) | Validação inline com `$request->validate([...])`. | `WaitingListController:154`, `SlotController:45`, etc. |
| **Mistura Eloquent / Query Builder** | `WaitingListCallController` usa `DB::table('waiting_list_calls')` cru apesar de existir o model `WaitingListCall`. | `WaitingListCallController:30,57,63,89` |
| **Sem eventos de domínio** | Nenhum `Event`, `Listener`, `Observer` ou `Job` de domínio. | `app/` não contém `Events/`, `Jobs/`, `Listeners/`, `Notifications/` |
| **Sem processamento assíncrono** | `QUEUE_CONNECTION=database` configurado mas nenhum job despachado. | `.env.example:39`; grep sem `dispatch(` |
| **Autorização em duas camadas** | Middleware `permission:` na rota + `$this->authorize()`/Policy no controller. Nem sempre consistentes entre si. | ver **04-autenticacao-e-autorizacao.md** |

### 2.3 Comunicação entre componentes

**Frontend → Backend:** exclusivamente via `@inertiajs/react` `router.get/post/put/delete`. Não há `fetch`/`axios` directo. [CONFIRMADO]

**Backend → Frontend:** três canais:

1. **Props da página** — `Inertia::render('Pagina', [...props])`.
2. **Props partilhadas** — `HandleInertiaRequests::share()` injecta em *todas* as páginas: `name`, `quote`, `toast` (lazy, da sessão), `auth.user`, `auth.roles`, `auth.permissions`. [CONFIRMADO — `app/Http/Middleware/HandleInertiaRequests.php:37-52`]
3. **Flash de sessão** — `back()->with('toast', [...])` / `->with('success', ...)` / `->with('error', ...)`.

**Inconsistência de canal de feedback [CONFIRMADO]:** existem três formatos de mensagem em uso simultâneo e apenas um é lido pelo frontend partilhado:

| Formato | Onde é emitido | Lido pelo frontend? |
|---|---|---|
| `->with('toast', ['type','title','description'])` | `WaitingListController`, `TeamController`, `RolePermissionController`, `WaitingListCallController` | Sim — `share()['toast']` |
| `->with('success', 'texto')` | `SlotController:62,93,112,121`, `ExcelImportController:30` | **Não** — nenhuma prop `success` é partilhada nem lida |
| `->with('error', 'texto')` | `WaitingListCallController:27,59` | **Não** — nenhuma prop `error` é partilhada nem lida |

Consequência: falhas de negócio em `pedirChamada` e `respostaChamada` (chamada bloqueada, chamada inexistente) são **silenciosas para o utilizador** — o pedido devolve 302/200 e o frontend interpreta como sucesso. Ver **07-inconsistencias-e-bugs.md § B-14**.

### 2.4 Dependências externas

| Dependência | Papel | Criticidade | Comportamento em falha |
|---|---|---|---|
| **Base de dados MySQL** | Persistência total + sessões + cache + filas | Crítica | Aplicação indisponível. Sem retry/fallback. |
| **Ficheiro Excel do sistema hospitalar** | Fonte de verdade dos doentes | Crítica para actualização | Upload manual; sem integração automática. Se o ficheiro tiver cabeçalhos diferentes, colunas são silenciosamente ignoradas (ver **03-business-logic.md § Import**). |
| **`spatie/laravel-permission`** | Toda a autorização | Crítica | Cache de permissões 24h em `CACHE_STORE` (database). Invalidação automática em alterações via package. `config/permission.php:183-205` |
| **DomPDF** | Exportação PDF da agenda | Baixa | Só afecta `/agenda/export/pdf`. |
| **`python/import_excel.py`** | Importador alternativo standalone | **Não integrado** | Script solto; liga directamente a MySQL com `user=root, password=""`. Nunca é invocado pelo Laravel. [CONFIRMADO — grep sem `exec`/`Process`/`shell_exec` no `app/`] |
| **Serviço de e-mail** | Recuperação de password | Baixa | `MAIL_MAILER=log` por omissão (`.env.example:51`) — em desenvolvimento os e-mails não saem. |

**Não existem integrações HTTP com sistemas externos.** Não há `Http::`, `Guzzle`, webhooks de entrada ou de saída, nem chamadas a APIs de terceiros. [CONFIRMADO — grep]

---

## 3. Modules & Components

### 3.1 Mapa de módulos

| # | Módulo | Responsabilidade | Controllers | Models | Policies | Páginas React |
|---|---|---|---|---|---|---|
| M1 | **Lista de Espera** | Consulta, filtragem, observações, situação interna, exportação | `WaitingListController` | `WaitingList` | `WaitingListPolicy` | `WaitingList/Index` |
| M2 | **Importação Excel** | Sincronização com o sistema hospitalar + histórico + posições | `ExcelImportController` | `WaitingList`, `WaitingListHistory` | — | `WaitingList/Import` |
| M3 | **Convocatórias (Chamadas)** | Pedido da equipa → resposta da secretaria | `WaitingListCallController` | `WaitingListCall` (vazio; acesso via `DB::table`) | — | `WaitingList/ChamadasPendentes` |
| M4 | **Blocos Operatórios (Slots)** | CRUD de blocos, repetição, trocas entre equipas | `SlotController` | `Slot` | `SlotPolicy` | `Slots/Index`, `Slots/SlotModal` |
| M5 | **Agendamentos (Schedules)** | Colocar doentes em slots, estado do agendamento, pernoita | `WaitingListController` (`storeSchedule`/`updateSchedule`); `ScheduleController` **vazio** | `Schedule` | `SchedulePolicy` | `Slots/CreateScheduleModal`, `Slots/EditScheduleModal`, `waiting-lists/ScheduleModal` |
| M6 | **Agenda** | Visualização diária/semanal/mensal + PDF | `AgendaController` | `Slot`, `Schedule` | — (só middleware) | `Agenda/Index`, `Agenda/Semana`, `Agenda/Mensal` |
| M7 | **Equipas** | CRUD de equipas, líder, cor, membros | `TeamController` | `Team` | `TeamPolicy` | `Teams/Index` |
| M8 | **Utilizadores** | CRUD de utilizadores + atribuição de role e equipa | `UserController` | `User` | — (só middleware) | `Users/Index`, `Users/Create`, `Users/Edit` |
| M9 | **RBAC** | Gestão de roles e permissões | `RolePermissionController` | `Role`, `Permission` (Spatie) | — (só middleware) | `RolesPermissions/Index` |
| M10 | **Autenticação** | Login, registo, reset de password, verificação de e-mail | `Auth/*` (starter kit Laravel) | `User` | — | `auth/*` |
| M11 | **Definições de conta** | Perfil, password, aparência | `Settings/*` | `User` | — | `settings/*` |
| M12 | **Contactos administrativos** | Registo de contactos ao doente | `WaitingListController::updateAdmin` | `WaitingListAdmin`, `WaitingListContact` | `WaitingListPolicy` | `waiting-lists/AdminObservacoesModal` |

### 3.2 Componentes sem responsabilidade activa

| Componente | Estado | Fonte |
|---|---|---|
| `ScheduleController` | Todos os 7 métodos vazios; **nenhuma rota registada** | `app/Http/Controllers/ScheduleController.php` |
| `WaitingListAdminController` | Todos os métodos vazios; nenhuma rota | idem |
| `WaitingListHistoryController` | Todos os métodos vazios; nenhuma rota. **O histórico é escrito mas nunca lido pela aplicação.** | idem |
| `App\Models\Agenda` | Classe `Pivot` vazia; tabela `agenda` só tem `id` + timestamps; `AgendaSeeder` insere 2 linhas sem significado | `app/Models/Agenda.php`, migração `2026_07_07_163810` |
| `App\Models\WaitingListCall` | Classe vazia — sem `$fillable`, sem relações. Todo o acesso é feito por `DB::table()` | `app/Models/WaitingListCall.php` |
| `App\Imports\WaitingListImport` | Código morto. Contém `dd($data)` na linha 45 (mataria o request). Mapeia campos que **não existem** na tabela (`data_inscricao`, `episodio_id`, `instituicao`, `medico_id`…) | `app/Imports/WaitingListImport.php` |
| `App\Imports\WaitingListChunkImport` + `App\Services\ExcelChunkProcessor` | Código morto — implementação alternativa do import, nunca invocada | verificado por grep |
| `App\Exports\WaitingListExport` | **Activo** — usado por `WaitingListController::export` | `WaitingListController:269` |
| `TeamController::updateMembers` | Implementado mas **sem rota registada** — inalcançável | `TeamController:106`, `routes/web.php` |
| `python/import_excel.py` | Script standalone, não integrado | — |
| Rota `/phpinfo` | Exposta publicamente, sem autenticação | `routes/web.php:98-100` |

### 3.3 Fluxos de negócio principais

| ID | Fluxo | Actores | Documento |
|---|---|---|---|
| F1 | Importação Excel → sincronização + histórico + recálculo de posições | Secretaria / Admin | `03-business-logic.md` |
| F2 | Consulta e filtragem da lista de espera | Todos com `waiting_list.view` | `03-business-logic.md` |
| F3 | Convocatória: equipa pede chamada → secretaria responde → situação interna do doente muda | Equipa + Secretaria | `03-business-logic.md`, `05-state-machines.md` |
| F4 | Criação de blocos operatórios (com repetição) | Admin | `03-business-logic.md` |
| F5 | Agendamento de doente em bloco → visível na Agenda → PDF | Equipa / Admin | `03-business-logic.md` |
| F6 | Registo de contacto administrativo ao doente | Secretaria | `03-business-logic.md` |
| F7 | Gestão de utilizadores, equipas e RBAC | Admin | `03-business-logic.md` |

### 3.4 Estrutura de ficheiros relevante

```
app/
├── Enum/
│   ├── ResultadoChamada.php      # situacao_interna do doente + resultado da chamada
│   ├── ScheduleEstadoTypes.php   # estado do agendamento cirúrgico
│   └── TipoChamada.php           # Ambulatorio | Base | SIGIC  (definido mas NUNCA usado)
├── Exports/WaitingListExport.php
├── Http/
│   ├── Controllers/              # 12 controllers de domínio + 10 de Auth/Settings
│   ├── Middleware/HandleInertiaRequests.php
│   └── Requests/                 # apenas Auth\LoginRequest e Settings\ProfileUpdateRequest
├── Imports/                      # ambos código morto
├── Models/                       # 10 models
├── Policies/                     # 4 policies
├── Providers/
│   ├── AppServiceProvider.php    # vazio
│   └── AuthServiceProvider.php   # regista as 4 policies
└── Services/
    ├── ExcelImportService.php    # ÚNICO service activo (475 linhas)
    └── ExcelChunkProcessor.php   # código morto

database/migrations/  # 18 migrações
database/seeders/     # 10 seeders
resources/js/         # SPA React
routes/web.php        # rotas de domínio
python/               # script standalone não integrado
```

---

## Documentos seguintes

| Ficheiro | Conteúdo |
|---|---|
| [`02-modelo-de-dados.md`](02-modelo-de-dados.md) | Data Model, ERD, Database Rules, Queries & Persistência |
| [`03-business-logic.md`](03-business-logic.md) | Business Logic detalhada por módulo (M1-M11) |
| [`04-api-endpoints.md`](04-api-endpoints.md) | Catálogo dos endpoints: inputs, validações, lógica, side effects, erros |
| [`05-autenticacao-e-autorizacao.md`](05-autenticacao-e-autorizacao.md) | Authentication & Authorization, Policies, Security Rules |
| [`06-state-machines.md`](06-state-machines.md) | Estados e transições (4 máquinas de estado) |
| [`07-erros-edge-cases-e-fluxos.md`](07-erros-edge-cases-e-fluxos.md) | Error Handling, Edge Cases, Side Effects, Async, Fluxos End-to-End, Observabilidade |
| [`08-inconsistencias-e-bugs.md`](08-inconsistencias-e-bugs.md) | Inconsistências, bugs potenciais, assumptions e ambiguidades |
| [`09-matrizes.md`](09-matrizes.md) | Business Rules Matrix, Dependency Map, Glossário |

> **Referências cruzadas:** ao longo dos documentos, `08 § B-xx` remete para um bug em `08-inconsistencias-e-bugs.md`, `05 § Segurança` para a secção de segurança de `05-autenticacao-e-autorizacao.md`, e `BR-xx` para uma regra da matriz em `09-matrizes.md`.
