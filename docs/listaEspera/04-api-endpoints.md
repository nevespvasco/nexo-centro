# 04 — APIs / Endpoints

> **Nota de arquitectura:** não existe API JSON. Todos os endpoints são rotas web Inertia. As respostas são:
> - **HTML completo** (primeiro carregamento) ou **JSON Inertia** (`X-Inertia: true`) para GETs de página;
> - **302 redirect** para operações de escrita (o Inertia refaz o GET da página de origem);
> - **422** com `errors` para falhas de validação;
> - **binário** (`.xlsx` / `.pdf`) para exportações.
>
> Todas as rotas web exigem **CSRF token** (`X-XSRF-TOKEN`), gerido automaticamente pelo Inertia.

---

## 1. Legenda de autorização

| Símbolo | Significado |
|---|---|
| 🔓 | **Sem autenticação** — rota fora do grupo `middleware(['auth'])` |
| 🔐 | Requer sessão autenticada |
| `perm:X` | Middleware `permission:X` do Spatie |
| `policy:X` | `$this->authorize(...)` no controller |

---

## 2. Módulo: Lista de Espera

| # | Método | Rota | Auth | Inputs | Validações | Business Logic | BD | Side effects | Response | Erros possíveis |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `GET` | `/waiting-lists` | 🔐 `perm:waiting_list.view` `policy:viewAny` | Query: `num_processo`, `situacao[]`, `estado`, `prioridade`, `des_diagnostico`, `page` | Nenhuma (filtros livres) | Defaults de `situacao`/`estado` (R-LE1); filtro por equipa em `equipaOptions` e `slotsDisponiveis` mas **não** na query principal | 6 SELECTs + `WaitingList::all()` | — | `200` Inertia `WaitingList/Index` | `403` sem permissão; `500` se `situacao_interna` fora do enum |
| 2 | `GET` | `/waiting-lists/create` | 🔐 `perm:waiting_list.view` | — | — | **Método vazio** | — | — | `200` vazio | — |
| 3 | `POST` | `/waiting-lists` | 🔐 `perm:waiting_list.view` | — | — | **Método vazio** | — | — | `200` vazio | — |
| 4 | `GET` | `/waiting-lists/{waitingList}` | 🔐 `perm:waiting_list.view` | Path: id | Route-model binding | **Método vazio** | SELECT (binding) | — | `200` vazio | `404` |
| 5 | `GET` | `/waiting-lists/{waitingList}/edit` | 🔐 `perm:waiting_list.view` | Path: id | idem | **Método vazio** | SELECT | — | `200` vazio | `404` |
| 6 | `PUT/PATCH` | `/waiting-lists/{waitingList}` | 🔐 `perm:waiting_list.view` ⚠ | Path: id | idem | **Método vazio** | SELECT | — | `200` vazio | `404` |
| 7 | `DELETE` | `/waiting-lists/{waitingList}` | 🔐 `perm:waiting_list.view` ⚠ | Path: id | idem | **Método vazio** | SELECT | — | `200` vazio | `404` |
| 8 | `POST` | `/waiting-lists/{waitingList}/admin` | 🔐 `perm:waiting_list.manage` `policy:update` | Body: `contactado?`, `data_contacto`, `contactado_por`, `contact_result`, `observacoes?` | `data_contacto` required date; `contactado_por` required max 255; `contact_result` required string; `observacoes` nullable | Cria contacto no histórico + tenta actualizar estado admin | `INSERT waiting_list_contacts` + `UPDATE waiting_list_admin` | — | `302` + toast | `403`; `422`; **`500` sempre** (coluna `contact_result` inexistente) |
| 9 | `PUT` | `/waiting-lists/{waitingList}/observacoes-gerais` | 🔐 `perm:waiting_list.manage` `policy:update` | Body: `observacoes_secretaria?` | nullable string | Escreve `observacoes_secretaria` | `UPDATE waiting_list` | — | `302` + toast | `403`; `404` |
| 10 | `GET` | `/waiting/export` | 🔐 `perm:waiting_list.export` + `abort_unless` | Query: `num_processo`, `des_diagnostico`, `situacao[]`, `estado` | Nenhuma | Restringe por equipa se não for admin/secretaria | `SELECT` sem paginação | Gera ficheiro em memória | `200` `.xlsx` | `403`; **`500`** para não-admin (coluna `equipa_id`) |
| 11 | `POST` | `/waiting-list/{id}/situacao-interna` | 🔓 **NENHUMA** | Path: id · Body: `situacao_interna` | required + `Rule::in(ResultadoChamada)` | Substituição directa, sem regra de transição | `SELECT` + `UPDATE waiting_list` | Altera elegibilidade para convocatória | `302` + toast | `404`; `422` |

**Observação sobre 6 e 7:** `Route::resource('waiting-lists', ...)` aplica `permission:waiting_list.view` a **todos** os verbos, incluindo `PUT` e `DELETE`. Se os métodos viessem a ser implementados, seriam escritas protegidas apenas por uma permissão de leitura. [CONFIRMADO — `routes/web.php:24-25`]

---

## 3. Módulo: Importação Excel

| # | Método | Rota | Auth | Inputs | Validações | Business Logic | BD | Side effects | Response | Erros |
|---|---|---|---|---|---|---|---|---|---|---|
| 12 | `GET` | `/waiting-list/import` | 🔐 `perm:waiting_list.import` | — | — | Closure — só renderiza | — | — | `200` Inertia `WaitingList/Import` | `403` |
| 13 | `POST` | `/waiting-list/import` | 🔐 `perm:waiting_list.import` | `multipart/form-data`: `file` | `required\|file\|mimes:xlsx` + extensão original `xlsx` | Todo o fluxo de `ExcelImportService` (ver `03 § M2`) | Por lote: `INSERT OR IGNORE` + `UPSERT waiting_list` + `INSERT waiting_list_history`, em transacção; depois 2 `UPDATE` massivos de posições | `set_time_limit(0)`; ficheiro temporário; **sem logs** | `302` + flash `success` (não lido) | `403`; `422` (MIME/extensão); `500` (Excel corrompido, memória, timeout do servidor web) |

**Headers relevantes:** `Content-Type: multipart/form-data`, `X-XSRF-TOKEN`, `X-Inertia`.
**Limites:** dependem de `upload_max_filesize` e `post_max_size` do PHP — **não são verificados nem comunicados pela aplicação**. [CONFIRMADO — ausência de regra `max:` na validação]

---

## 4. Módulo: Convocatórias

| # | Método | Rota | Auth | Inputs | Validações | Business Logic | BD | Side effects | Response | Erros |
|---|---|---|---|---|---|---|---|---|---|---|
| 14 | `POST` | `/waiting-list/{id}/pedir-chamada` | 🔓 **NENHUMA** | Path: id · Body: `data_pretendida`, `tipo_chamada`, `observacoes?` | `data_pretendida` required date **after:today**; `tipo_chamada` required string (enum não aplicado); `observacoes` nullable | Guarda R-CH1 sobre `call->estado_novo` ∈ {Suspenso, Agendado, Operado} | `SELECT waiting_list` + `INSERT waiting_list_calls` | **Não altera** `situacao_interna` | `302` + toast sucesso | `404`; `422`; bloqueio de negócio devolve `302` com flash `error` **invisível** |
| 15 | `POST` | `/waiting-list/chamada/{callId}/resposta` | 🔓 **NENHUMA** | Path: callId · Body: `resultado`, `data_agendada?`, `observacoes?` | `resultado` required + `Rule::enum(ResultadoChamada)`; `data_agendada` `required_if:resultado,Agendado`, nullable, date; `observacoes` nullable | R-CH2 (resultado → `situacao_interna`), R-CH3 (`estado_anterior`) | `SELECT` + `UPDATE waiting_list_calls` + `SELECT` + `UPDATE waiting_list` | **Não** cria `Schedule` nem escreve `waiting_list.data_agenda` | `302` + toast | `422`; `404` via `findOrFail` do doente; chamada inexistente → `302` com flash `error` invisível |
| 16 | `GET` | `/waiting-list/chamadas/pendentes` | 🔓 **NENHUMA** | — | — | `whereNull('resultado')` — coluna nunca escrita → devolve tudo | `SELECT` + **N+1** (2 queries por linha) | — | `200` Inertia `WaitingList/ChamadasPendentes` | — |

> ⚠ **Estes três endpoints expõem e permitem alterar dados clínicos identificáveis sem qualquer autenticação.** Ver `05 § Segurança`.

---

## 5. Módulo: Slots

| # | Método | Rota | Auth | Inputs | Validações | Business Logic | BD | Response | Erros |
|---|---|---|---|---|---|---|---|---|---|
| 17 | `GET` | `/slots` | 🔐 `perm:slots.view` `policy:viewAny` | — | — | R-SL1 (visibilidade por equipa + trocas) | 2 SELECTs | `200` Inertia `Slots/Index` | `403` |
| 18 | `GET` | `/slots/create` | 🔐 `perm:slots.view` | — | — | **Método inexistente** no controller | — | `500` `BadMethodCallException` | — |
| 19 | `POST` | `/slots` | 🔐 `perm:slots.view` ⚠ `policy:create` (`slots.create`) | `data`, `hora_inicio`, `hora_fim`, `team_id`, `sala?`, `repeat_type`, `repeat_until?` | `data` required date; horas required; `team_id` required exists; `sala` nullable; `repeat_type` required in:none,daily,weekly,monthly; `repeat_until` nullable date | R-SL2, R-SL3 (geração da série) | N× `INSERT slots` (sem transacção) | `302` + flash `success` (não lido) | `403`; `422`; **loop longo** se `repeat_until` nulo e `data` no passado |
| 20 | `GET` | `/slots/{slot}` | 🔐 `perm:slots.view` | Path: id | binding | **Método inexistente** | SELECT | `500` | `404` |
| 21 | `GET` | `/slots/{slot}/edit` | 🔐 `perm:slots.view` | Path: id | binding | **Método inexistente** | SELECT | `500` | `404` |
| 22 | `PUT/PATCH` | `/slots/{slot}` | 🔐 `perm:slots.view` ⚠ `policy:update` (`slots.edit`) | `data`, `hora_inicio`, `hora_fim`, `team_id`, `sala?`, `observacoes?` | idem (sem repetição) | Sem verificação de agendamentos existentes | `UPDATE slots` | `302` + flash | `403`; `422` |
| 23 | `DELETE` | `/slots/{slot}` | 🔐 `perm:slots.view` ⚠ `policy:delete` (`slots.delete`) | Path: id | binding | Sem verificação de agendamentos | `DELETE slots` | `302` + flash | `403`; **`500`** se houver `schedules` (FK RESTRICT) |

> ⚠ **Nota transversal:** `Route::resource('slots', ...)->middleware('permission:slots.view')` aplica **`slots.view`** a todos os verbos. As permissões `slots.create`, `slots.edit` e `slots.delete` só são verificadas pelas policies do controller. Como no `RolesSeeder` apenas o `admin` as possui, o efeito prático é o mesmo — mas a intenção não está expressa na rota. [CONFIRMADO — `routes/web.php:42-43`]

---

## 6. Módulo: Agendamentos

| # | Método | Rota | Auth | Inputs | Validações | Business Logic | BD | Response | Erros |
|---|---|---|---|---|---|---|---|---|---|
| 24 | `POST` | `/waiting-lists/{waitingList}/schedule` | 🔐 `perm:schedules.create` `policy:update`(WaitingList) + `can('schedule', $slot)` | `slot_id`, `duracao_estimada?`, `estado`, `pernoita` | `slot_id` required exists; `duracao_estimada` nullable int min 1; `estado` **required string (sem enum)**; `pernoita` required in:sim,nao,talvez | Tripla autorização (ver `03 § 5.1`); `user_id` forçado a `auth()->id()` pelo model | `SELECT slots` + `INSERT schedules` | `302` + toast | `403` (×3 caminhos); `422`; `500` se sem sessão (`user_id` NULL) |
| 25 | `PUT` | `/waiting-lists/{waitingList}/schedule/{schedule}` | 🔐 `perm:schedules.edit` `policy:update` + `can('schedule',$slot)` + `can('schedules.edit')` | idem | idem | **Não verifica** que `{schedule}` pertence a `{waitingList}` | `SELECT` + `UPDATE schedules` | `302` + toast | `403`; `422`; `404` |

**Endpoints em falta [CONFIRMADO]:** não existe `DELETE` de agendamento nem rota alguma para `ScheduleController` (cujos 7 métodos estão vazios).

---

## 7. Módulo: Agenda

| # | Método | Rota | Auth | Inputs | Business Logic | Response | Erros |
|---|---|---|---|---|---|---|---|
| 26 | `GET` | `/agenda` | 🔐 `perm:agenda.view` | — | R-AG1 (exclui cancelados), R-AG2 (paleta de cores); **sem filtro de data** | `200` Inertia `Agenda/Index` | `403` |
| 27 | `GET` | `/agenda/semana` | 🔐 `perm:agenda.view` | Query: `start?` | Semana Seg→Dom; R-AG1; R-AG3 (doentes disponíveis, sem limite) | `200` Inertia `Agenda/Semana` | `403`; `500` se `start` inválido |
| 28 | `GET` | `/agenda/mensal` | 🔐 `perm:agenda.view` | Query: `month?` | Grelha mensal completa; R-AG1; R-AG3 | `200` Inertia `Agenda/Mensal` | `403`; `500` se `month` inválido |
| 29 | `GET` | `/agenda/export/pdf` | 🔐 `perm:agenda.export` | Query: `type=semana\|mensal`, `start?`, `month?` | R-AG1; DomPDF A4 landscape | `200` `application/pdf` (download) | `403`; `500` (data inválida ou falha do DomPDF) |

**Sem filtro por equipa em nenhuma vista de agenda** — qualquer utilizador com `agenda.view` vê os blocos e doentes de **todas** as equipas. [CONFIRMADO]

---

## 8. Módulo: Equipas

| # | Método | Rota | Auth | Inputs | Validações | Business Logic | Response | Erros |
|---|---|---|---|---|---|---|---|---|
| 30 | `GET` | `/teams` | 🔐 `perm:teams.view` `policy:viewAny` | — | — | Não-admin/secretaria vê só a sua equipa | `200` Inertia `Teams/Index` | `403` |
| 31 | `GET` | `/teams/{team}` | 🔐 `perm:teams.view` | Path: id | — | **Método inexistente** no controller | `500` | `404` |
| 32 | `POST` | `/teams` | 🔐 `perm:teams.manage` `policy:create` | `nome`, `cor`, `sala_default?`, `ativa`, `leader_id?` | `nome` required max 255; `cor` required max 20; `ativa` required boolean; `leader_id` nullable exists | `sala_default` validado e descartado | `302` + toast | `403`; `422` |
| 33 | `PUT/PATCH` | `/teams/{team}` | 🔐 `perm:teams.manage` `policy:update` | idem | idem | Líder pode editar a sua equipa | `302` + toast | `403`; `422` |
| 34 | `DELETE` | `/teams/{team}` | 🔐 `perm:teams.manage` `policy:delete` (**só admin**) | Path: id | — | Sem verificação de dependências | `302` + toast | `403`; **`500`** por FK RESTRICT |
| — | — | *(updateMembers)* | — | — | — | **Sem rota registada** | — | — |

Também existem `GET /teams/create` e `GET /teams/{team}/edit` (gerados pelo `Route::resource`) que apontam para métodos inexistentes → `500`.

---

## 9. Módulo: Utilizadores

| # | Método | Rota | Auth | Inputs | Validações | Business Logic | Response | Erros |
|---|---|---|---|---|---|---|---|---|
| 35 | `GET` | `/users` | 🔐 `perm:users.view` | Query: `page` | — | Paginação 10 | `200` Inertia `Users/Index` | `403` |
| 36 | `GET` | `/users/{user}` | 🔐 `perm:users.view` | Path: id | — | Renderiza `Users/Show` — **página React inexistente** | `500` no cliente | `404` |
| 37 | `GET` | `/users/create` | 🔐 `perm:users.manage` | — | — | Carrega roles + equipas | `200` Inertia `Users/Create` | `403` |
| 38 | `POST` | `/users` | 🔐 `perm:users.manage` | `name`, `email`, `password`, `role`, `team_id?` | `password` **min:6**; `email` unique; `role` exists em `roles` | R-U1 (equipa obrigatória), R-U2 (líder → `teams.leader_id`); coluna `role` **não** persistida | `302` `users.index` | `403`; `422` |
| 39 | `GET` | `/users/{user}/edit` | 🔐 `perm:users.manage` | Path: id | — | — | `200` Inertia `Users/Edit` | `403`; `404` |
| 40 | `PUT/PATCH` | `/users/{user}` | 🔐 `perm:users.manage` | `name`, `email`, `role`, `team_id?` | `email` unique ignorando o próprio | `syncRoles`; R-U1; R-U2. **Não altera password** | `302` `users.index` | `403`; `422` |
| 41 | `DELETE` | `/users/{user}` | 🔐 `perm:users.manage` | Path: id | — | Sem policy, sem confirmação, permite auto-eliminação | `302` `users.index` | `403`; **`500`** por FK RESTRICT |

---

## 10. Módulo: RBAC

| # | Método | Rota | Auth | Inputs | Validações | Business Logic | Response |
|---|---|---|---|---|---|---|---|
| 42 | `GET` | `/access-control` | 🔐 `perm:users.manage` | — | — | Roles com permissões + todas as permissões | `200` Inertia `RolesPermissions/Index` |
| 43 | `POST` | `/access-control/roles` | 🔐 `perm:users.manage` | `name`, `permissions[]?` | `name` unique em `roles`; `permissions.*` exists | `findOrCreate` + `syncPermissions` | `302` + toast |
| 44 | `PUT` | `/access-control/roles/{role}` | 🔐 `perm:users.manage` | idem | unique ignorando o próprio | Substitui **todas** as permissões | `302` + toast |
| 45 | `DELETE` | `/access-control/roles/{role}` | 🔐 `perm:users.manage` | Path: id | — | **R-RB1:** bloqueia a role `admin` | `302` + toast ou `withErrors` |
| 46 | `POST` | `/access-control/permissions` | 🔐 `perm:users.manage` | `name` | unique | `findOrCreate` | `302` + toast |
| 47 | `PUT` | `/access-control/permissions/{permission}` | 🔐 `perm:users.manage` | `name` | unique ignorando o próprio | Renomear **parte os middlewares** que comparam por string | `302` + toast |
| 48 | `DELETE` | `/access-control/permissions/{permission}` | 🔐 `perm:users.manage` | Path: id | — | Sem protecção de permissões nucleares | `302` + toast |

---

## 11. Autenticação e Definições

| # | Método | Rota | Auth | Validações / Regras | Notas |
|---|---|---|---|---|---|
| 49 | `GET` | `/` | 🔓 | — | Página `welcome` |
| 50 | `GET` | `/dashboard` | 🔐 | — | Closure; página com placeholders, **sem conteúdo de negócio** |
| 51 | `GET` | `/register` | guest | — | **Registo público aberto** |
| 52 | `POST` | `/register` | guest | `name` required max 255; `email` unique lowercase; `password` `Rules\Password::defaults()` + confirmed | **Sem role, sem equipa.** Faz login automático. Dispara `Registered` (que tenta enviar e-mail de verificação) |
| 53 | `GET` | `/login` | guest | — | — |
| 54 | `POST` | `/login` | guest | `email` required email; `password` required string | **Rate limit: 5 tentativas** por `email\|IP`; dispara `Lockout`. `remember` → escreve `remember_token` (**coluna inexistente**) |
| 55 | `POST` | `/logout` | 🔐 | — | Invalida sessão + regenera token CSRF |
| 56 | `GET` | `/forgot-password` · `POST /forgot-password` | guest | `email` required | `throttle` do broker de passwords |
| 57 | `GET` | `/reset-password/{token}` · `POST /reset-password` | guest | `token`, `email`, `password` confirmed + defaults | Escreve `remember_token` → **coluna inexistente** |
| 58 | `GET` | `/verify-email` · `GET /verify-email/{id}/{hash}` · `POST /email/verification-notification` | 🔐 (+`signed`, `throttle:6,1`) | — | **Inertes:** `User` não implementa `MustVerifyEmail` e não há coluna `email_verified_at` |
| 59 | `GET/POST` | `/confirm-password` | 🔐 | `password` required | Usado por `password.confirm` — **nenhuma rota o exige** |
| 60 | `GET` | `/settings/profile` · `PATCH /settings/profile` | 🔐 | `name` required; `email` unique lowercase | Alterar e-mail escreve `email_verified_at = null` → **coluna inexistente** |
| 61 | `DELETE` | `/settings/profile` | 🔐 | `password` required `current_password` | Logout + `delete()` + invalidação de sessão. **Sem verificação de dependências** → `500` por FK se o utilizador tiver agendamentos ou for líder |
| 62 | `GET` | `/settings/password` · `PUT /settings/password` | 🔐 | `current_password` + `Password::defaults()` + confirmed | — |
| 63 | `GET` | `/settings/appearance` | 🔐 | — | Closure |
| 64 | `GET` | `/settings` | 🔐 | — | `redirect` → `/settings/profile` |
| 65 | `GET` | `/up` | 🔓 | — | Health check do Laravel |
| 66 | `GET` | `/phpinfo` | 🔓 | — | **`phpinfo()` público** — expõe versões, caminhos, extensões, variáveis de ambiente. Ver `05 § Segurança` |

---

## 12. Códigos de estado HTTP em uso

| Código | Quando ocorre | Origem |
|---|---|---|
| `200` | GET de página (Inertia); download de ficheiro | — |
| `302` | Toda operação de escrita bem-sucedida (`back()` / `redirect()`) | Controllers |
| `403` | Middleware `permission:` falha; `$this->authorize()` falha; `abort(403)`; `abort_unless` | Spatie + Policies |
| `404` | `findOrFail`; route-model binding sem correspondência | Eloquent |
| `409` | **Nunca usado** — não há detecção de conflito | — |
| `419` | Token CSRF expirado | Middleware `web` |
| `422` | Falha de validação (`ValidationException`) — inclui rate limit de login | `Request::validate` |
| `429` | `throttle:6,1` nas rotas de verificação de e-mail | Middleware |
| `500` | Erros SQL (colunas inexistentes, FK RESTRICT), `ValueError` de enums, métodos inexistentes, `InvalidFormatException` de datas | Não tratados |
| `503` | Modo de manutenção | Laravel |

**Não existe handler de excepções personalizado** — `bootstrap/app.php:30-31` tem o bloco `withExceptions` vazio. Todo o tratamento é o do Laravel por omissão. Com `APP_DEBUG=true` (default do `.env.example:4`), o **stack trace completo é devolvido ao cliente**. [CONFIRMADO]

---

## 13. Headers relevantes

| Header | Uso |
|---|---|
| `X-Inertia: true` | Marca pedido Inertia; resposta é JSON em vez de HTML |
| `X-Inertia-Version` | Versionamento de assets; mismatch → `409` com `X-Inertia-Location` (gerido pelo package) |
| `X-Inertia-Partial-Data` / `X-Inertia-Partial-Component` | Reloads parciais (`router.reload({only:['agenda']})`) |
| `X-XSRF-TOKEN` | CSRF, obrigatório em todos os verbos de escrita |
| `Cookie: laravel_session` | Sessão em BD, 120 min (`SESSION_LIFETIME`) |
| `Link` | Preload de assets (`AddLinkHeadersForPreloadedAssets`) |
| `Content-Type: multipart/form-data` | Apenas no upload de Excel |
