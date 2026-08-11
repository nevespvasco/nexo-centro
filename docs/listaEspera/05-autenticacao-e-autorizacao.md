# 05 — Authentication, Authorization & Security Rules

---

## 1. Autenticação

### 1.1 Mecanismo

| Aspecto | Configuração | Fonte |
|---|---|---|
| Guard por omissão | `web`, driver `session`, provider `users` | `config/auth.php` |
| Provider | `eloquent` sobre `App\Models\User` | idem |
| Armazenamento de sessão | Tabela `sessions` (`SESSION_DRIVER=database`) | `.env.example:31` |
| Duração da sessão | 120 minutos | `.env.example:32` |
| Cookie | `http_only=true`, `same_site=lax`, `secure` **não definido** (null) | `config/session.php:172,185,202` |
| Encriptação de sessão | **Desactivada** (`SESSION_ENCRYPT=false`) | `.env.example:33` |
| Hash de password | bcrypt, 12 rounds | `.env.example:17` |
| Tokens de API | **Não existem** — sem Sanctum, sem Passport | `composer.json` |

**`SESSION_SECURE_COOKIE` não está definido** — o cookie de sessão é transmitido em HTTP simples se a aplicação não estiver atrás de HTTPS forçado. [CONFIRMADO — ausente de `.env.example`]

### 1.2 Fluxos de autenticação

| Fluxo | Rota | Regras | Estado |
|---|---|---|---|
| **Login** | `POST /login` | `email` + `password`; rate limit **5 tentativas** por chave `lower(email)\|IP`; evento `Lockout`; `RateLimiter::clear` em sucesso | Funcional, excepto "remember" |
| **Registo público** | `POST /register` | `Password::defaults()` (8 caracteres); e-mail único; login automático | **Aberto a qualquer pessoa** |
| **Logout** | `POST /logout` | Invalida sessão + regenera CSRF | Funcional |
| **Reset de password** | `/forgot-password`, `/reset-password` | Broker `users`, tabela `password_reset_tokens`, expiração 60 min | **Parte** ao escrever `remember_token` |
| **Verificação de e-mail** | `/verify-email/*` | `signed` + `throttle:6,1` | **Inerte** — `User` não implementa `MustVerifyEmail` |
| **Confirmação de password** | `/confirm-password` | — | **Nunca exigida** por nenhuma rota |

### 1.3 Falhas estruturais de autenticação

**[CONFIRMADO] Colunas em falta na tabela `users`:** a migração `0001_01_01_000000_create_users_table.php` cria apenas `id, name, email, password, role, timestamps` (+ `team_id` numa migração posterior). Faltam `email_verified_at` e `remember_token`, que o código escreve:

| Local | Escrita | Consequência |
|---|---|---|
| `LoginRequest::authenticate():44` + `auth/login.tsx:15,27` | `Auth::attempt(..., remember: true)` → o Laravel faz `UPDATE users SET remember_token = ?` | **Login com "lembrar-me" activo rebenta com erro SQL** |
| `Auth/NewPasswordController.php:51` | `'remember_token' => Str::random(60)` | **Reset de password rebenta sempre** |
| `Settings/ProfileController.php:35` | `email_verified_at = null` quando o e-mail muda | **Alterar o e-mail rebenta** |
| `database/factories/UserFactory.php:29,31` | ambas | **Todos os testes que criem utilizadores falham** (`DashboardTest`, `Auth/*`, `Settings/*`) |

**[CONFIRMADO] Registo público sem controlo:** `/register` está acessível sem convite nem aprovação. `RegisteredUserController::store()` **não atribui role nem equipa**. O utilizador criado fica com:
- coluna `role = 'team_member'` (default da BD),
- **zero roles Spatie** → `getAllPermissions()` devolve vazio.

Consequência de segurança: a conta autentica-se, chega ao `/dashboard` e é bloqueada por `403` em todas as rotas com `permission:`. **Mas tem acesso total aos 4 endpoints públicos de convocatórias** (que nem precisam de conta). Num sistema com dados clínicos, o registo aberto deveria estar desactivado. [CONFIRMADO]

---

## 2. Autorização

### 2.1 Arquitectura em duas camadas

```
Pedido HTTP
   │
   ├── CAMADA 1 — Middleware de rota:  permission:<nome>
   │     Spatie PermissionMiddleware. Verifica se o utilizador
   │     tem a permissão (directa ou via role). Falha → 403.
   │     Registado em bootstrap/app.php:19-23 como alias 'permission'.
   │
   └── CAMADA 2 — Policy no controller:  $this->authorize(...) / $user->can(...)
         Verifica de novo a permissão E aplica regras de propriedade
         (equipa do utilizador vs equipa do recurso).
```

**As duas camadas nem sempre concordam** — ver § 2.6.

### 2.2 Papéis

Existem **dois sistemas de papéis em paralelo** [CONFIRMADO]:

| Sistema | Onde | Uso |
|---|---|---|
| Coluna `users.role` (string livre, default `'team_member'`) | Migração `0001_01_01_000000` + `2026_07_12_214647` | Fallback nos helpers do model; `SlotSeeder:42` filtra por ela |
| Roles Spatie (`model_has_roles`) | Migração `2026_07_09_065800` | Fonte de todas as permissões |

**Helpers do model `User` [CONFIRMADO — `User.php:39-62`]:**

| Método | Implementação | Nota |
|---|---|---|
| `isAdmin()` | `hasRole('admin') \|\| role === 'admin'` | duplo |
| `isSecretary()` | `hasRole('secretaria') \|\| role === 'secretaria'` | duplo |
| `isTeamLeader()` | `hasAnyRole(['team_leader','lider']) \|\| role === 'lider'` | duplo (só testa `'lider'` na coluna, não `'team_leader'`) |
| `isTeamMember()` | `hasAnyRole(['team_member','membro'])` | **só Spatie** — sem fallback |
| `belongsToTeam(?int $teamId)` | `!is_null($teamId) && (int)$this->team_id === (int)$teamId` | Devolve `false` se `$teamId` for `null` |

**Roles criadas pelo seeder [CONFIRMADO — `RolesSeeder.php:55-62`]:**
`admin`, `secretaria`, `team_member`, `team_leader` + as legadas `membro` e `lider` (que recebem as mesmas permissões das novas).

**`belongsToTeam(null) === false`** é uma decisão importante: um utilizador **sem equipa** falha todas as verificações de propriedade. Combinado com o bug do `equipa_id` (que devolve sempre `null`), isto faz com que **`WaitingListPolicy::view` e `update` recusem sempre** para membros e líderes. Ver `08 § B-01`.

### 2.3 Permissões

**23 permissões definidas** [CONFIRMADO — `RolesSeeder.php:15-49`]:

| Domínio | Permissões |
|---|---|
| Agenda | `agenda.view`, `agenda.export` |
| Slots | `slots.view`, `slots.create`, `slots.edit`, `slots.delete` |
| Schedules | `schedules.view`, `schedules.create`, `schedules.edit`, `schedules.delete`, `schedules.move` |
| Waiting List | `waiting_list.view`, `waiting_list.manage`, `waiting_list.export`, `waiting_list.import`, `waiting_list.observacoes.gerais` |
| Users / Teams | `users.view`, `users.manage`, `teams.view`, `teams.manage` |
| Roles | `roles.view`, `roles.manage` |

**Permissões definidas mas nunca verificadas [CONFIRMADO]:**
- `waiting_list.observacoes.gerais` — a rota de observações usa `waiting_list.manage`.
- `roles.manage` — as rotas de RBAC usam `users.manage`.
- `roles.view` — só serve para mostrar o item no menu lateral.
- `schedules.view` — só em `SchedulePolicy::viewAny`, que nunca é invocada.
- `schedules.delete` — `SchedulePolicy::delete` existe, sem rota.
- `schedules.move` — `SlotPolicy::requestSwap`/`approveSwap`, sem rota.

### 2.4 Matriz Role × Permissão (configuração de raiz)

[CONFIRMADO — `RolesSeeder.php:64-87`]

| Permissão | `admin` | `secretaria` | `team_leader` / `lider` | `team_member` / `membro` |
|---|:---:|:---:|:---:|:---:|
| `agenda.view` | ✅ | ❌ | ❌ | ❌ |
| `agenda.export` | ✅ | ❌ | ❌ | ❌ |
| `slots.view` | ✅ | ❌ | ❌ | ❌ |
| `slots.create` / `.edit` / `.delete` | ✅ | ❌ | ❌ | ❌ |
| `schedules.*` (5) | ✅ | ❌ | ❌ | ❌ |
| `waiting_list.view` | ✅ | ✅ | ✅ | ✅ |
| `waiting_list.manage` | ✅ | ✅ | ❌ | ❌ |
| `waiting_list.export` | ✅ | ✅ | ❌ | ❌ |
| `waiting_list.import` | ✅ | ✅ | ❌ | ❌ |
| `waiting_list.observacoes.gerais` | ✅ | ❌ | ❌ | ❌ |
| `users.view` / `users.manage` | ✅ | ❌ | ❌ | ❌ |
| `teams.view` | ✅ | ✅ | ✅ | ❌ |
| `teams.manage` | ✅ | ❌ | ❌ | ❌ |
| `roles.view` / `roles.manage` | ✅ | ❌ | ❌ | ❌ |

**Conclusões de negócio [CONFIRMADO]:**

1. **`admin` recebe `syncPermissions(Permission::all())`** — todas as permissões existentes no momento em que o seeder corre. Permissões criadas depois (via `/access-control`) **não** são atribuídas automaticamente.
2. **Nenhuma role além de `admin` pode ver a agenda, os slots ou criar agendamentos.** Todo o módulo de agendamento cirúrgico é, de raiz, exclusivo do administrador.
3. **Equipas só conseguem *ver* a lista de espera.** Não podem editar observações, não podem exportar, não podem agendar.
4. Os endpoints de convocatória (`pedir-chamada`, `resposta`) não têm permissões associadas — é a única acção que uma equipa consegue realmente executar, e apenas porque não está protegida.

> **[INFERIDO]** A matriz de raiz parece um estado inicial mínimo, com a expectativa de que o administrador redistribua as permissões via `/access-control`. Mas o resultado, tal como está, é um sistema em que o fluxo principal descrito na UI (equipa pede → secretaria responde → equipa agenda) **não é executável** por ninguém excepto o admin, e mesmo assim só através de rotas não autenticadas. **[NÃO DETERMINÁVEL]** se a matriz de produção corresponde à do seeder.

### 2.5 Policies em detalhe

Registadas em `AuthServiceProvider.php:19-24`: `Slot`, `Schedule`, `WaitingList`, `Team`. **Não existem policies para `User`, `Role`, `Permission`, `WaitingListCall`, `WaitingListAdmin`, `WaitingListContact`.**

#### `WaitingListPolicy`

| Método | Regra | Invocado em |
|---|---|---|
| `viewAny` | `can('waiting_list.view')` | `WaitingListController::index` |
| `view` | `can('waiting_list.view')` **E** (admin ∨ secretaria ∨ `belongsToTeam($wl->equipa_id)`) | **Nunca invocado** |
| `update` | `can('waiting_list.manage')` **E** (admin ∨ secretaria ∨ (líder **E** `belongsToTeam($wl->equipa_id)`)); membro → `false` | `updateAdmin`, `storeSchedule`, `updateSchedule`, `updateObservacoesGerais` |

**Regras de negócio expressas:**
- Admin e secretaria têm acesso irrestrito.
- Líder de equipa pode actualizar doentes **da sua equipa**.
- Membro de equipa **nunca** pode actualizar (`return false` explícito, `WaitingListPolicy.php:47`).

**Regras quebradas [CONFIRMADO]:** `$wl->equipa_id` é sempre `null` (a coluna chama-se `team_id`) → `belongsToTeam(null)` → `false`. Portanto **nenhum líder consegue actualizar nada**, independentemente da configuração de permissões. Ver `08 § B-01`.

#### `SlotPolicy`

| Método | Regra |
|---|---|
| `viewAny` | `can('slots.view')` |
| `create` | `can('slots.create')` |
| `update` | `can('slots.edit')` **E** (admin ∨ secretaria ∨ `belongsToTeam($slot->team_id)`) |
| `delete` | `can('slots.delete')` **E** (admin ∨ secretaria ∨ (**líder** ∧ `belongsToTeam($slot->team_id)`)) |
| `schedule` | `can('schedules.create')` **E** (admin ∨ secretaria ∨ (`is_swapped` ? `belongsToTeam(swapped_to_team_id)` : `belongsToTeam(team_id)`)) |
| `requestSwap` | `can('schedules.move')` **E** `belongsToTeam($slot->team_id)` |
| `approveSwap` | `can('schedules.move')` **E** líder **E** `belongsToTeam($slot->team_id)` |

**Regras de negócio expressas:**
- Qualquer membro da equipa proprietária pode **editar** o slot; apagar requer ser **líder**.
- **A troca desvia a propriedade para efeitos de agendamento:** num slot trocado, só a equipa receptora pode agendar. Mas pedir e aprovar a troca continua a caber à equipa **proprietária** (aprovação só pelo líder).
- Assimetria deliberada: `update` aceita qualquer membro, `delete` exige líder.

#### `SchedulePolicy`

| Método | Regra |
|---|---|
| `viewAny` | `can('schedules.view')` |
| `create` | `can('schedules.create')` **E** (admin ∨ secretaria ∨ (`is_swapped` ? `belongsToTeam(swapped_to_team_id)` : `belongsToTeam(slot.team_id)`)) |
| `update` | `can('schedules.edit')` **E** (admin ∨ secretaria ∨ **`$this->create($user, $schedule)`**) |
| `delete` | `can('schedules.delete')` **E** (admin ∨ secretaria ∨ (líder ∧ `belongsToTeam(schedule.slot.team_id)`) ∨ `$this->create(...)`) |

**Dependência entre regras [CONFIRMADO]:** `update` e `delete` **delegam em `create`**. Isto significa que quem não tiver `schedules.create` **não pode editar nem apagar** um agendamento, mesmo tendo `schedules.edit`/`schedules.delete`. É uma dependência implícita e não óbvia entre permissões. [CONFIRMADO — `SchedulePolicy.php:54,74`]

**Nota:** `delete` para um líder usa `$schedule->slot->team_id` — ignora o desvio por troca, ao contrário de `create`. Um líder da equipa proprietária pode apagar agendamentos criados pela equipa **receptora**. [CONFIRMADO — `SchedulePolicy.php:70`] Ver `08 § B-24`.

**Nenhum destes métodos é invocado por qualquer rota.** `Schedule` nunca passa por `authorize()`. A autorização de agendamentos é feita indirectamente via `WaitingListPolicy::update` + `SlotPolicy::schedule`. [CONFIRMADO]

#### `TeamPolicy`

| Método | Regra |
|---|---|
| `viewAny` | `can('teams.view')` |
| `view` | `can('teams.view')` **E** (admin ∨ secretaria ∨ `belongsToTeam($team->id)`) |
| `create` | `can('teams.manage')` |
| `update` | `can('teams.manage')` **E** (admin ∨ (líder ∧ `belongsToTeam($team->id)`)) |
| `delete` | `can('teams.manage')` **E** `isAdmin()` |

**Nota:** a secretaria tem `teams.view` mas **não** `teams.manage` → pode ver, não pode editar. Apagar é exclusivo do admin, mesmo com `teams.manage`.

### 2.6 Divergências entre middleware e policy

[CONFIRMADO — comparação `routes/web.php` × controllers]

| Rota | Middleware exige | Policy/controller exige | Efeito |
|---|---|---|---|
| `POST /slots` | `slots.view` | `slots.create` | Middleware mais fraco; a policy é a barreira real |
| `PUT /slots/{slot}` | `slots.view` | `slots.edit` + propriedade | idem |
| `DELETE /slots/{slot}` | `slots.view` | `slots.delete` + líder/propriedade | idem |
| `PUT/DELETE /waiting-lists/{id}` | `waiting_list.view` | *(métodos vazios)* | Escritas protegidas só por permissão de leitura — perigoso se implementadas |
| `POST /waiting-lists/{id}/schedule` | `schedules.create` | `waiting_list.manage` **+** `schedules.create` + propriedade | **Conjunção de permissões de domínios diferentes** — só o admin as reúne |
| `PUT .../schedule/{schedule}` | `schedules.edit` | `waiting_list.manage` + `schedules.create` (via `SlotPolicy::schedule`) + `schedules.edit` | idem |
| `GET /waiting/export` | `waiting_list.export` | `abort_unless(can('waiting_list.export'))` | Verificação duplicada, coerente |
| `/access-control/*` | `users.manage` | — | `roles.manage` existe e não é usada |

**Regra de prioridade observada:** o middleware corre **primeiro**; se falhar, a policy nunca é avaliada. Quando ambos existem, o resultado é a **conjunção** (AND) das duas condições — a mais restritiva vence. [CONFIRMADO — ordem de execução do Laravel]

### 2.7 Autorização no frontend

**Nunca é a fonte de verdade** — é apenas cosmética.

| Local | Mecanismo |
|---|---|
| Menu lateral | `NavMain::canViewItem` — `item.permissions.some(p => userPermissions.includes(p))` (**OR**, não AND) — `nav-main.tsx:21-27` |
| Botão "Importar Excel" | `permissions.includes('waiting_list.import')` — `WaitingList/Index.tsx:296` |
| Formulário de contacto | `canEdit = permissions.includes('waiting_list.manage')` — `AdminObservacoesModal.tsx:32` |
| Botão "Convocar" | `disabled={i.situacao_interna != 'Ativo'}` — regra de **estado**, não de permissão |

**Problemas [CONFIRMADO]:**
- `app-sidebar.tsx:70` — `permissions: ['teams.vie']` (**erro de escrita**: falta o `w`). Esta permissão não existe, portanto `some()` devolve `false` para toda a gente → **o item "Equipas" nunca aparece no menu**, nem para o administrador.
- `app-sidebar.tsx:27-31` — "Doentes a contactar" **não tem `permissions`** → aparece para todos os utilizadores autenticados, incluindo os que acabaram de se registar sem role.
- `app-sidebar.tsx:15-19` — "Dashboard" também sem restrição (aceitável).
- O `AdminObservacoesModal` esconde o formulário mas **mostra sempre o histórico de contactos** a quem consiga abrir o modal.

---

## 3. Security Rules

### 3.1 Achados críticos

| # | Achado | Severidade | Detalhe |
|---|---|---|---|
| **S-1** | **Quatro rotas de negócio sem autenticação** | 🔴 Crítica | `routes/web.php:91-96`. `POST /waiting-list/{id}/pedir-chamada`, `POST /waiting-list/chamada/{callId}/resposta`, `GET /waiting-list/chamadas/pendentes`, `POST /waiting-list/{id}/situacao-interna`. Estão **depois** do fecho do grupo `middleware(['auth'])` (linha 89). Permitem **ler dados clínicos identificáveis** (nome, diagnóstico, observações) e **escrever** no estado dos doentes, sem qualquer credencial. |
| **S-2** | **`GET /phpinfo` público** | 🔴 Crítica | `routes/web.php:98-100`. Expõe versão do PHP, caminhos absolutos, extensões, configuração e **variáveis de ambiente** (que podem incluir credenciais de BD). |
| **S-3** | **`APP_DEBUG=true` por omissão** | 🟠 Alta | `.env.example:4`. Em produção devolve stack traces com queries SQL e caminhos. Combinado com os erros 500 frequentes (colunas inexistentes), expõe estrutura de BD a qualquer visitante. |
| **S-4** | **Registo público aberto** | 🟠 Alta | `/register` sem convite. Cria conta sem role, que ganha acesso ao menu "Doentes a contactar" e aos endpoints S-1. |
| **S-5** | **Sem filtro por equipa na listagem** | 🟠 Alta | `WaitingListController::index` não restringe por equipa. Qualquer utilizador com `waiting_list.view` (todas as roles) vê **todos** os doentes. `WaitingListPolicy::view` existe e nunca é chamada. |
| **S-6** | **Sem `SESSION_SECURE_COOKIE`** | 🟡 Média | Cookie de sessão pode trafegar em HTTP. |
| **S-7** | **Password mínima de 6 caracteres** na criação por admin | 🟡 Média | `UserController:35`, contra `Password::defaults()` (8) no registo público. |
| **S-8** | **Sem confirmação de operações destrutivas** | 🟡 Média | `Slots/Index.tsx:115` chama `router.delete` directamente. Idem para utilizadores e equipas. |
| **S-9** | **Sem rate limiting nas rotas de negócio** | 🟡 Média | Só `/login` (5 tentativas) e `/verify-email` (`throttle:6,1`). Os endpoints públicos S-1 não têm limite. |
| **S-10** | **Sem auditoria de acções de utilizador** | 🟡 Média | `waiting_list_history` só regista alterações de **origem `excel`**. Não há registo de quem alterou `situacao_interna`, `observacoes_secretaria`, quem exportou dados, quem apagou o quê. |

### 3.2 Access control por recurso

| Recurso | Regra de acesso implementada | Regra ausente |
|---|---|---|
| `WaitingList` | Permissão global `waiting_list.view` | **Filtro por equipa na listagem** (policy `view` nunca invocada) |
| `Slot` | Permissão + propriedade de equipa (com desvio por troca) | Nenhuma relevante |
| `Schedule` | Indirecta, via `WaitingList` + `Slot` | Verificação de que `{schedule}` pertence a `{waitingList}` |
| `Team` | Permissão + propriedade | Nenhuma relevante |
| `User` | Só `permission:users.manage` | **Sem policy.** Sem protecção contra auto-eliminação nem contra remoção do último admin |
| `Role` / `Permission` | Só `permission:users.manage` | **Sem policy.** Sem protecção de permissões nucleares |
| `WaitingListCall` | **Nenhuma** | Tudo |

### 3.3 Access control por estado

| Regra | Onde | Estado |
|---|---|---|
| Não convocar doente já `Suspenso`/`Agendado`/`Operado` | `WaitingListCallController:26` | **Ineficaz** — `hasOne` devolve a chamada mais antiga; valores não pertencem ao enum |
| Botão "Convocar" só activo se `situacao_interna === 'Ativo'` | `WaitingList/Index.tsx:517` | Só no cliente; contornável |
| Agendamentos cancelados não aparecem na agenda | `AgendaController` (4 locais) | Funcional |
| Doente com schedule `agendado` não é oferecido para novo agendamento | `AgendaController:146,201` | Parcial — não exclui `operado`, e `'confirmado'` não existe |
| Role `admin` não pode ser apagada | `RolePermissionController:58` | Funcional, mas contornável (esvaziar/renomear) |

### 3.4 Privilege escalation — vectores identificados

| Vector | Descrição |
|---|---|
| **PE-1** | Quem tem `users.manage` pode atribuir-se a si próprio (ou a outros) a role `admin` via `PUT /users/{user}`. Não há separação entre "gerir utilizadores" e "conceder administração". [CONFIRMADO] |
| **PE-2** | Quem tem `users.manage` controla também todo o RBAC (`/access-control`) e pode adicionar qualquer permissão a qualquer role. `users.manage` é, efectivamente, equivalente a `admin`. [CONFIRMADO] |
| **PE-3** | Renomear ou apagar uma permissão via `/access-control/permissions` remove silenciosamente a protecção das rotas que a referenciam por string. [CONFIRMADO] |
| **PE-4** | Os endpoints públicos (S-1) permitem a **qualquer pessoa** executar acções de negócio reservadas a equipas e secretaria. [CONFIRMADO] |

### 3.5 Validação de inputs — cobertura

| Categoria | Estado |
|---|---|
| SQL Injection | **Protegido** — todas as queries usam Eloquent/Query Builder com bindings. Os únicos `DB::statement` são SQL estático sem interpolação de input (`ExcelImportService:432,456`). [CONFIRMADO] |
| Mass assignment | **Protegido** por `$fillable` em todos os models relevantes. Efeito colateral: campos legítimos fora de `$fillable` (`repeat_type`, `repeat_until`) são descartados. |
| XSS | **Maioritariamente protegido** por React. **Uma excepção:** `WaitingList/Index.tsx:570` usa `dangerouslySetInnerHTML={{__html: link.label}}` sobre os labels de paginação — conteúdo gerado pelo Laravel, não pelo utilizador. Risco baixo. [CONFIRMADO] |
| CSRF | **Protegido** pelo middleware `web` + Inertia. |
| Upload de ficheiros | Validado por `mimes:xlsx` + extensão. **Sem limite de tamanho** na aplicação. |
| Enums | **Inconsistente** — `situacao_interna` e `resultado` validados; `schedules.estado`, `tipo_chamada` e `contact_result` **não**. |
| Datas | `date` genérico. Só `data_pretendida` tem `after:today`. Nenhuma validação de coerência (`hora_fim > hora_inicio`, `repeat_until > data`). |
| Tamanho de texto | `observacoes`, `observacoes_secretaria`, `swap_reason` sem `max:` → limitados apenas pelo tipo `TEXT` (64 KB). |

### 3.6 Dados sensíveis

| Dado | Onde | Protecção |
|---|---|---|
| `waiting_list.nome` (nome do doente) | BD, `ChamadasPendentes`, `SituacaoInternaModal` | **Exposto sem autenticação** via endpoint 16 |
| `num_processo` | BD, listagem, export | Permissão `waiting_list.view` (todas as roles) |
| `des_diagnostico`, `patologia` | idem + `ChamadasPendentes` | **Exposto sem autenticação** via endpoint 16 |
| `observacoes_*` | idem | idem |
| `password` | `users.password` | bcrypt 12 rounds; `$hidden` no model |
| Credenciais de BD | `.env` | **Expostas via `/phpinfo`** (S-2) |
| Credenciais MySQL hard-coded | `python/import_excel.py:21-26` — `user="root", password=""` | **Em texto claro no repositório.** Script não integrado, mas as credenciais estão versionadas. [CONFIRMADO] |

**Não existe encriptação de dados em repouso** para nenhuma coluna. Nenhum campo usa `encrypted` cast. [CONFIRMADO]

### 3.7 Audit logs

**Não existe sistema de auditoria de acções de utilizador.** [CONFIRMADO]

O que existe:
- `waiting_list_history` — só alterações vindas do Excel, com `origem = 'excel'`, e **incompleto** por causa do `break` (ver `03 § 2.7`). Nunca é lido pela aplicação.
- `waiting_list_contacts` — histórico de contactos, com `contactado_por` como **string livre** (não uma FK a `users`) → não identifica o utilizador da aplicação de forma fiável.
- `waiting_list_calls` — regista `pedido_por_user_id` e `secretaria_user_id` (nullable, e nulos quando não há sessão) e `estado_anterior` (apenas 1 nível).
- `schedules.user_id` — quem criou o agendamento. Não regista quem o **alterou**.
- Logs do Laravel — `LOG_CHANNEL=stack`, `LOG_LEVEL=debug`. Não há qualquer `Log::` no código de domínio activo.

**Sem rasto para:** alteração de `situacao_interna`, edição de `observacoes_secretaria`, exportação de dados, criação/edição/eliminação de slots, alterações de roles e permissões, eliminação de utilizadores ou equipas.
