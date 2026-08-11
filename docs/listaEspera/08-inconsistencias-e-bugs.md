# 08 — Inconsistências, Possíveis Bugs, Assumptions e Ambiguidades

> Este documento **apenas documenta**. Nenhum comportamento do sistema foi alterado.
> Severidade: 🔴 Crítica (quebra funcionalidade ou segurança) · 🟠 Alta · 🟡 Média · 🟢 Baixa

---

## Parte A — Inconsistências e possíveis bugs

### B-01 🔴 `equipa_id` vs `team_id` — coluna inexistente

**Estado:** CONFIRMADO PELO CÓDIGO

A tabela `waiting_list` tem a coluna **`team_id`** (migração `2026_07_05_164325:48`). Nenhuma migração cria `equipa_id`. Mas o código refere-se consistentemente a `equipa_id`:

| Local | Código |
|---|---|
| `app/Models/WaitingList.php:33` | `'equipa_id'` em `$fillable` |
| `app/Models/WaitingList.php:70` | `belongsTo(Team::class, 'equipa_id')` |
| `app/Models/Team.php:35` | `hasMany(WaitingList::class, 'equipa_id')` |
| `app/Policies/WaitingListPolicy.php:27` | `belongsToTeam($wl->equipa_id)` |
| `app/Policies/WaitingListPolicy.php:43` | idem |
| `app/Http/Controllers/WaitingListController.php:248` | `->where('equipa_id', ...)` |

**Impacto:**
1. `WaitingListController::export` lança **erro SQL** para qualquer utilizador que não seja admin nem secretaria → a exportação está partida para equipas.
2. `$wl->equipa_id` devolve sempre `null` (atributo inexistente) → `belongsToTeam(null)` devolve `false` → **`WaitingListPolicy::view` e `update` recusam sempre** para líderes e membros. Nenhum líder de equipa consegue actualizar observações, registar contactos ou agendar.
3. `WaitingList::team()` e `Team::waitingList()` devolvem sempre vazio.

**Nota:** a coluna `team_id` de `waiting_list` **nunca é escrita por nenhum fluxo da aplicação** — apenas pelo `WaitingListSeeder:47`. Mesmo corrigindo o nome, a associação doente↔equipa continuaria por preencher.

---

### B-02 🔴 `contact_result` não existe em `waiting_list_admin`

**Estado:** CONFIRMADO PELO CÓDIGO

`waiting_list_admin` tem: `contactado`, `data_contacto`, `contactado_por`, `observacoes` (migração `2026_07_06_143728`). **Não tem `contact_result`.**

Mas:
- `WaitingListAdmin.php:17` declara-a em `$fillable`;
- `WaitingListController::updateAdmin:172` faz `$waitingList->admin()->update($data)` com `$data` a incluir `contact_result`;
- `WaitingListAdminSeeder:25` também a escreve.

**Impacto:** `POST /waiting-lists/{id}/admin` devolve **500 sempre**. O `WaitingListContact` de (1) já foi criado (não há transacção) → estado inconsistente.

**Bug secundário no mesmo método:** mesmo sem esse problema, `admin()->update()` numa relação `hasOne` **sem registo existente** actualiza 0 linhas silenciosamente. Falta `updateOrCreate`. O registo administrativo nunca é criado por este fluxo.

---

### B-03 🔴 Coluna `resultado` nunca escrita

**Estado:** CONFIRMADO PELO CÓDIGO

`waiting_list_calls.resultado` é a coluna semanticamente central (o comentário da migração lista `Agendado / VoltaLista / Recusou / NA / Indisponível`) e é o **único** critério de "pendente":

```php
// WaitingListCallController:90
DB::table('waiting_list_calls')->whereNull('resultado')
```

Mas `respostaChamada:63-71` grava em `estado_novo`, **não** em `resultado`.

**Impacto:** a página "Convocatórias Pendentes" mostra **todas as convocatórias de sempre**, respondidas ou não. Não há forma de saber o que está por responder. O trabalho da secretaria acumula visualmente sem fim.

---

### B-04 🟠 `hasOne` devolve a chamada mais antiga

**Estado:** CONFIRMADO PELO CÓDIGO

`WaitingList::call()` é `hasOne(WaitingListCall::class)` (`WaitingList.php:83-86`) sem `latestOfMany()`. A tabela aceita N convocatórias por doente.

**Impacto na guarda de negócio** (`WaitingListCallController:26`): a verificação avalia sempre a **primeira** convocatória do doente. Depois de a primeira ser respondida (`estado_novo` deixa de ser `Suspenso`), a guarda nunca mais bloqueia → convocatórias ilimitadas.

**Impacto na UI:** `Index.tsx:518-523` mostra "Convocado" com base em `i.call?.id` — sempre verdadeiro se alguma vez houve uma convocatória, mesmo já resolvida.

O mesmo problema aplica-se a `WaitingList::admin()` e `WaitingList::schedule()`.

---

### B-05 🟠 `situacao_color` rebenta com valor fora do enum

**Estado:** CONFIRMADO PELO CÓDIGO

```php
// WaitingList.php:41,88-91
protected $appends = ['situacao_color'];
public function getSituacaoColorAttribute(): string {
    return ResultadoChamada::from($this->situacao_interna)->color();
}
```

`Enum::from()` lança `ValueError` para valores desconhecidos (ao contrário de `tryFrom()`). Como o accessor está em `$appends`, corre em **toda** a serialização do model.

**Impacto:** um único registo com `situacao_interna` inválido (escrita directa em BD, migração de dados legados, ou `null`) **rebenta a listagem, a agenda e as convocatórias com 500**.

O mesmo padrão em `Schedule::getEstadoCorAttribute` (`Schedule.php:49-52`) — ver B-07.

**Duplicação relacionada:** `WaitingListController::index:75-78` recalcula `situacao_color` manualmente sobre `WaitingList::all()`, algo que o accessor já faz automaticamente.

---

### B-06 🟠 `repeat_type` / `repeat_until` fora de `$fillable`

**Estado:** CONFIRMADO PELO CÓDIGO

`Slot.php:11-23` não inclui `repeat_type` nem `repeat_until`. `SlotController::store:58,87` usa `Slot::create($data)`.

**Impacto:** todos os slots são criados com `repeat_type = 'none'` e `repeat_until = null`, independentemente do que foi pedido. Os slots da série existem, mas:
- não há como identificar que pertencem a uma série;
- não há como editar ou apagar a série em bloco;
- `Slots/Index.tsx:58-59` lê estes campos para pré-preencher o formulário de edição → mostra sempre "Não repetir".

---

### B-07 🟠 Estado legado `realizado` em `schedules`

**Estado:** CONFIRMADO PELO CÓDIGO

Cronologia:
1. `2026_07_05_164433:14` — `enum('agendado','realizado','cancelado') DEFAULT 'agendado'`.
2. `2026_07_10_220203:16` — coluna convertida para `string` com default `'proposto'`.
3. `ScheduleEstadoTypes` define `proposto|pronto|agendado|operado|cancelado` — **sem `realizado`**.

**Impactos:**
- Linhas antigas com `realizado` fazem `ScheduleEstadoTypes::from()` lançar `ValueError` → 500 na agenda, PDF e modal de slot.
- `resources/js/types/Schedule.ts:6` ainda declara `"realizado"` e não declara `"pronto"` nem `"operado"`.
- **A migração `down()` referencia `waiting_list_schedules`**, tabela que não existe (`2026_07_10_220203:25`) → rollback impossível.
- A coluna deixou de ter qualquer constraint e o controller valida apenas `required|string`.

---

### B-08 🔴 Colunas `email_verified_at` e `remember_token` inexistentes

**Estado:** CONFIRMADO PELO CÓDIGO

A migração `0001_01_01_000000` cria `users` sem estas duas colunas. O código escreve em ambas:

| Local | Escrita | Consequência |
|---|---|---|
| `LoginRequest:44` + `auth/login.tsx:15,27` | `Auth::attempt(..., remember)` | Login com "lembrar-me" → erro SQL |
| `Auth/NewPasswordController:51` | `remember_token` | Reset de password → erro SQL **sempre** |
| `Settings/ProfileController:35` | `email_verified_at = null` | Alterar e-mail → erro SQL |
| `database/factories/UserFactory:29,31` | ambas | **Toda a suite de testes que crie utilizadores falha** |

---

### B-09 🟡 Dois sistemas de papéis em paralelo, dessincronizados

**Estado:** CONFIRMADO PELO CÓDIGO

Coexistem `users.role` (string) e as roles Spatie. Os helpers do `User` verificam ambos com OR, **excepto `isTeamMember()`** que só verifica Spatie (`User.php:54-57`).

**Fontes de dessincronização:**
- `UserController::store:46-51` **não persiste `role`** → fica o default `'team_member'` mesmo que a role Spatie seja `admin`.
- `UserController::update:86` **persiste**.
- `RegisteredUserController` não atribui nem role Spatie nem escreve `role`.
- `DatabaseSeeder:18-28` cria o admin sem `role` e depois faz `syncRoles(['admin'])`.

**Impacto:** queries que filtrem por `users.role` dão resultados errados. `SlotSeeder:42` faz `where('role','lider')` e não encontra utilizadores criados pela aplicação. Nomenclatura dupla (`membro`/`team_member`, `lider`/`team_leader`) agrava o problema.

---

### B-10 🟠 `WaitingList::all()` carregado e descartado

**Estado:** CONFIRMADO PELO CÓDIGO

`WaitingListController::index:75-78` carrega **toda** a tabela em memória, mapeia cada registo para recalcular `situacao_color` (que o accessor já produz) e passa o resultado como prop `lista`.

`resources/js/pages/WaitingList/Index.tsx:87-116` **não desestrutura `lista`** — a prop nunca é usada.

**Impacto:** com dezenas de milhares de doentes, cada carregamento da lista de espera carrega tudo em memória e serializa-o para JSON, para o deitar fora no cliente. Risco de esgotamento de memória e degradação severa.

---

### B-11 🟡 Slots de hoje excluídos de `slotsDisponiveis`

**Estado:** CONFIRMADO PELO CÓDIGO

```php
// WaitingListController:64
->where('data', '>=', now())
```

`data` é `DATE`; `now()` é serializado como `DATETIME`. O MySQL promove a coluna a `00:00:00` para comparar → um slot de hoje (`2026-08-08 00:00:00`) é sempre `<` `2026-08-08 11:23:45`.

**Impacto:** os slots do próprio dia nunca aparecem no modal de agendamento. Deveria ser `now()->toDateString()` ou `today()`.

---

### B-12 🔴 `break` na comparação do import trunca a auditoria

**Estado:** CONFIRMADO PELO CÓDIGO

```php
// ExcelImportService:262-276
if ($oldNorm !== $newNorm) {
    $changed = true;
    $batchHistory[] = [...];
    break;   // ⚡ early exit → 20× mais rápido
}
```

**Impacto:** o `upsert` escreve **todos** os campos alterados, mas o histórico regista **apenas o primeiro** na ordem fixa de `getComparableFields()`. Se um doente mudar de `situacao` e de `prioridade` no mesmo import, só a `prioridade` (5.ª) fica registada — a `situacao` (7.ª) desaparece do rasto.

Num contexto de lista de espera cirúrgica, o histórico de alterações de prioridade e situação é precisamente o que interessa auditar.

Os dois importadores mortos (`ExcelChunkProcessor:85-103` e `python/import_excel.py:207-219`) **registam todos os campos**. O comportamento correcto existe, apenas não no caminho activo.

---

### B-13 🟡 `cod_medico` e `interv_cirurgica` nunca são escritos

**Estado:** CONFIRMADO PELO CÓDIGO

Ambos estão no `headerMap` (`:47-49`) e são copiados em `normalizeRow` (`:149-173`). Mas `getComparableFields()` (`:323-345`) **não os inclui**, e `processBatch:219-222` filtra `$data` por `array_intersect_key(..., array_flip($comparableFields))`.

**Impacto:** as colunas `cod_medico` e `interv_cirurgica` ficam sempre `NULL` para registos importados por este service. `nome_clinico` (o nome do médico) é importado, mas o código não.

---

### B-14 🟠 Três formatos de flash, só um é lido

**Estado:** CONFIRMADO PELO CÓDIGO

`HandleInertiaRequests::share()` só expõe `toast`. Mas:
- `SlotController` (4 locais) e `ExcelImportController` usam `->with('success', ...)`;
- `WaitingListCallController` (2 locais) usa `->with('error', ...)`.

**Impacto:** as duas mensagens de erro de negócio do sistema — "Doente não pode ser chamado" e "Pedido de chamada não encontrado" — **são invisíveis**. O frontend recebe 302/200, o `onSuccess` do Inertia dispara e o utilizador vê a operação como bem-sucedida. É uma falha silenciosa em regras de negócio reais.

---

### B-15 🟠 Duas definições incompatíveis de "posição por patologia"

**Estado:** CONFIRMADO PELO CÓDIGO

| Aspecto | `ExcelImportService` (activo) | `ExcelChunkProcessor` (morto) |
|---|---|---|
| Campo de agrupamento | `LEFT(des_diagnostico, 2)` | `LEFT(patologia, 2)` |
| Filtro em `posicao_patologia` | `situacao NOT IN ('Operado','Cancelado')` | `estado NOT IN ('F','C') AND situacao NOT IN (...)` |
| Filtro em `posicao_lista` | **nenhum** | `estado NOT IN ('F','C') AND situacao NOT IN (...)` |
| `ORDER BY` | `prioridade, data_marcacao IS NULL, data_marcacao, id` | `prioridade, data_marcacao, id` |
| Guarda SQLite | sim | não |

**Contradição interna no service activo:** `posicao_lista` inclui doentes operados e cancelados; `posicao_patologia` exclui-os. As duas posições apresentadas lado a lado na UI ("P. Absoluta" / "P. Relativa") são calculadas sobre populações diferentes e **não são comparáveis**.

**Ambiguidade de domínio:** agrupar por 2 caracteres de `des_diagnostico` (texto livre) versus de `patologia` (campo dedicado) são decisões de negócio muito diferentes. **[NÃO DETERMINÁVEL]** qual é a correcta.

---

### B-16 🟡 Prop `open` recebe uma função

**Estado:** CONFIRMADO PELO CÓDIGO

```jsx
// WaitingList/Index.tsx:605
<PedirChamadaModal open={modalAbertoPedirChamadaModal} ... />
```

`modalAbertoPedirChamadaModal` é a **função** que abre o modal (linha 241); o estado booleano chama-se `modalAberto` (linha 239) e **nunca é lido**.

Uma função é truthy → o guard `if (!open || !doente) return null` passa a depender apenas de `doente`. Funciona por acidente: fechar o modal põe `doenteSelecionado = null`, o que o esconde.

**Bug relacionado:** `setDoenteSelecionado(i.id)` (linha 516) passa um **número**, não o objecto do doente. Daí o modal mostrar "Pedir Chamada para 1234" em vez do nome (`PedirChamadaModal.tsx:52`).

**Também:** `PedirChamadaModal.tsx:39` faz `toast.success('asdas')` — texto de teste esquecido em produção.

---

### B-17 🔴 A configuração de permissões torna o agendamento inexecutável

**Estado:** CONFIRMADO PELO CÓDIGO

`POST /waiting-lists/{id}/schedule` exige, cumulativamente:
1. `schedules.create` (middleware),
2. `waiting_list.manage` (via `WaitingListPolicy::update`),
3. `SlotPolicy::schedule` (que exige de novo `schedules.create` + propriedade).

Cruzando com `RolesSeeder`:

| Role | (1) | (2) | Resultado |
|---|:---:|:---:|---|
| `admin` | ✅ | ✅ | Pode |
| `secretaria` | ❌ | ✅ | **Não pode** |
| `team_leader` | ❌ | ❌ | **Não pode** |
| `team_member` | ❌ | ❌ | **Não pode** |

**Impacto:** na configuração de raiz, **só o administrador consegue agendar uma cirurgia**. Toda a lógica de propriedade de equipa e de desvio por troca de slot em `SlotPolicy::schedule` e `SchedulePolicy::create` é inalcançável — o admin passa sempre pelo atalho `isAdmin()`.

A conjunção de `schedules.create` com `waiting_list.manage` é, em si, questionável: agendar num bloco não é conceptualmente "gerir a lista de espera".

---

### B-18 🟠 `{schedule}` não é validado contra `{waitingList}`

**Estado:** CONFIRMADO PELO CÓDIGO

`updateSchedule(Request $request, WaitingList $waitingList, Schedule $schedule)` — ambos resolvidos por route-model binding **independentemente**. Não há verificação de que `$schedule->waiting_list_id === $waitingList->id`.

**Impacto:** um utilizador autorizado sobre o doente A pode enviar `PUT /waiting-lists/{A}/schedule/{id_do_schedule_do_doente_B}`. A policy avalia o doente A; o UPDATE aplica-se ao agendamento de B. É um vector de **IDOR** (Insecure Direct Object Reference).

---

### B-19 🟠 O cancelamento de agendamento nunca funciona

**Estado:** CONFIRMADO PELO CÓDIGO

```jsx
// EditScheduleModal.tsx:112-114
router.put(`/waiting-lists/${schedule.waiting_list_id}/schedule/${schedule.id}`,
  { estado: 'cancelado', duracao_estimada: form.duracao_estimada, slot_id: form.slot_id }, ...)
```

O payload **omite `pernoita`**, que o backend valida como `required|string|in:sim,nao,talvez` (`WaitingListController:222`).

**Impacto:** 422 sempre. Como o cancelamento lógico é o **único** mecanismo de remoção de agendamentos (não existe DELETE), **não é possível cancelar um agendamento pela interface**.

---

### B-20 🟡 Dois esquemas de cor de equipa incompatíveis

**Estado:** CONFIRMADO PELO CÓDIGO

| Origem | Onde é usada |
|---|---|
| `teams.cor` (coluna, definida pelo utilizador) | `Agenda/Semana.tsx:156-157` |
| `teamColors[id]` (paleta de 10, por índice de iteração) | `AgendaController:80-96,126-142,181-197`; `Slots/SlotModal.tsx:24` |

**Impactos:**
1. No mesmo ecrã (`Semana` → `SlotModal`), um slot muda de cor ao abrir o detalhe.
2. A paleta é atribuída por `$palette[$index % 10]` sobre `Team::all()` — **criar ou apagar uma equipa reatribui as cores de todas as seguintes**.
3. Com mais de 10 equipas, as cores repetem-se.
4. `Semana.tsx:156` faz `slot.team.cor + '20'` (sufixo alpha hex) — só funciona se `cor` for um hex de 6 dígitos; o backend valida apenas `string|max:20`.

---

### B-21 🟡 `'confirmado'` não existe e `'operado'` não é excluído

**Estado:** CONFIRMADO PELO CÓDIGO

```php
// AgendaController:146-148 e 201-203
WaitingList::whereDoesntHave('schedules', fn($q) => $q->whereIn('estado', ['agendado','confirmado']))
```

`'confirmado'` não pertence a `ScheduleEstadoTypes` → condição sempre falsa, sem efeito.
`'operado'` **não** está na lista → doentes já operados continuam a aparecer como disponíveis para novo agendamento.
A query não tem `limit` nem paginação.

---

### B-22 🟡 Duas fontes de verdade para o líder de equipa

**Estado:** CONFIRMADO PELO CÓDIGO

`teams.leader_id` pode ser escrito por dois caminhos independentes:
- `TeamController::store/update` (campo do formulário de equipa);
- `UserController::store/update:55-57,90-92` — atribuir a role `team_leader`/`lider` **sobrescreve** `leader_id`.

**Impacto:** promover um segundo líder substitui o primeiro sem aviso. O anterior mantém a role `team_leader` → passa a haver dois utilizadores com role de líder e apenas um em `leader_id`. `User::isTeamLeader()` devolve `true` para ambos, portanto as policies tratam-nos como equivalentes.

Não há forma de **despromover** um líder: remover a role não limpa `teams.leader_id`.

---

### B-23 🟠 Sem protecção contra perda de administração

**Estado:** CONFIRMADO PELO CÓDIGO

A única salvaguarda de RBAC é `RolePermissionController:58-60` (não apagar a role `admin`). É insuficiente:

| Vector | Efeito |
|---|---|
| `PUT /access-control/roles/{admin}` com `permissions: []` | Esvazia a role `admin` — ninguém fica com permissões |
| `PUT /access-control/roles/{admin}` com outro `name` | A role deixa de se chamar `admin`; `isAdmin()` passa a `false` para todos |
| `PUT /users/{id}` removendo a role admin do último administrador | Sistema sem administrador |
| `DELETE /users/{id}` do último administrador | idem |
| `DELETE /access-control/permissions/{users.manage}` | Ninguém consegue voltar a `/access-control` |

Não há verificação de "último administrador" em lado nenhum. A recuperação exigiria acesso directo à BD ou ao Tinker.

---

### B-24 🟢 `SchedulePolicy::delete` ignora o desvio por troca

**Estado:** CONFIRMADO PELO CÓDIGO

`SchedulePolicy::delete:70` usa `$schedule->slot->team_id` para o ramo do líder, enquanto `create:29-34` desvia para `swapped_to_team_id` quando `is_swapped`.

**Impacto:** num slot trocado, o líder da equipa **proprietária** pode apagar agendamentos criados pela equipa **receptora** — que é quem tem legitimidade sobre o bloco. Inconsistência entre as duas regras.

(Sem impacto prático imediato: `SchedulePolicy` nunca é invocada por nenhuma rota.)

---

### B-25 🟢 `ResultadoChamada::label()` nunca é usado

**Estado:** CONFIRMADO PELO CÓDIGO

O enum define `label()` (`:33-44`) com uma diferença semântica relevante: `Ativo` → **"Volta à lista"**. O método nunca é chamado — nem no PHP nem no frontend. `WaitingListController:89` envia `ResultadoChamada::getAll()` (os **values**), e `SituacaoInternaModal`/`SituacaoBadge` mostram o value cru.

**Impacto:** a UI mostra "Ativo" onde o autor pretendia "Volta à lista". O `SecretariaRespostaModal` também mostra "Ativo" como opção de resultado de chamada, o que é confuso — o utilizador não percebe que significa "devolver à lista".

---

### B-26 🟡 A regra de elegibilidade para convocatória só existe no cliente

**Estado:** CONFIRMADO PELO CÓDIGO

`Index.tsx:517` — `disabled={i.situacao_interna != 'Ativo'}`.

O backend `pedirChamada` **não verifica `situacao_interna`** — usa a guarda ineficaz sobre `call->estado_novo` (B-04). Um pedido enviado directamente ao endpoint (que, além disso, é público) contorna a regra completamente.

---

### B-27 🟠 Três noções não sincronizadas de "doente agendado"

**Estado:** CONFIRMADO PELO CÓDIGO

| Fonte | Escrita por | Lida por |
|---|---|---|
| `waiting_list.data_agenda` | Import Excel (hospital) | Só exibida no export |
| `waiting_list_calls.data_agendada` | `respostaChamada` (secretaria) | Só exibida em `ChamadasPendentes` |
| `schedules` com `estado = 'agendado'` | `storeSchedule` (bloco) | Agenda, PDF, filtro de disponíveis |

**Nenhuma escreve nas outras.** Consequências concretas:
- A secretaria marca `resultado = 'Agendado'` com uma data → **nenhum `Schedule` é criado** → a cirurgia não aparece na agenda.
- Um `Schedule` passa a `operado` → **`waiting_list.data_operado` e `situacao_interna` não mudam** → o doente continua na lista como activo.
- O hospital marca `data_agenda` no Excel → a aplicação ignora-o completamente.

Este é o **desalinhamento funcional mais significativo** do sistema: os três fluxos de negócio (hospital, secretaria, bloco) operam sobre o mesmo doente sem se reconhecerem.

---

### B-28 🟢 Erro de escrita bloqueia o menu "Equipas"

**Estado:** CONFIRMADO PELO CÓDIGO

`app-sidebar.tsx:70` — `permissions: ['teams.vie']` (falta o `w`). `NavMain::canViewItem` faz `some()` sobre as permissões do utilizador; `'teams.vie'` não existe → `false` para todos.

**Impacto:** o item "Equipas" **nunca aparece no menu**, nem para o administrador. `/teams` continua acessível por URL directo.

---

### B-29 🟢 Item de menu "Doentes a contactar" sem restrição

**Estado:** CONFIRMADO PELO CÓDIGO

`app-sidebar.tsx:27-31` não declara `permissions` → visível para todos os utilizadores autenticados, incluindo contas recém-registadas sem qualquer role. A rota de destino também não tem autenticação (S-1).

---

### B-30 🟢 Código morto e resíduos

**Estado:** CONFIRMADO PELO CÓDIGO

| Item | Localização |
|---|---|
| `dd($data)` num importador | `app/Imports/WaitingListImport.php:45` |
| Importador com campos inexistentes (`data_inscricao`, `episodio_id`, `instituicao`, `medico_id`…) | idem, linhas 25-43 |
| `ExcelChunkProcessor` + `WaitingListChunkImport` — implementação alternativa nunca invocada | `app/Services/`, `app/Imports/` |
| `ScheduleController`, `WaitingListAdminController`, `WaitingListHistoryController` — 21 métodos vazios | `app/Http/Controllers/` |
| `TeamController::updateMembers` sem rota | `TeamController:106` |
| `App\Enum\TipoChamada` nunca referenciado | `app/Enum/TipoChamada.php` |
| `App\Models\Agenda` — Pivot vazio; tabela só com `id` | `app/Models/Agenda.php` |
| `ExcelImportController::page()` sem rota (a rota usa uma closure) | `ExcelImportController:33` |
| `console.log` em produção | `ScheduleModal.tsx:50`, `ChamadasPendentes.tsx:34` |
| `toast.success('asdas')` | `PedirChamadaModal.tsx:39` |
| `$created = 1` nunca usado; `$date` inicializado duas vezes | `SlotController:67,66,69` |
| `array_merge(parent::share(...), [...parent::share(...), ...])` | `HandleInertiaRequests:41-42` |
| Credenciais MySQL em texto claro (`root` / vazia) | `python/import_excel.py:21-26` |
| Estados no modal do frontend (`showContactModal`, `showScheduleModal`) que nunca são activados | `WaitingList/Index.tsx:138,147` |

**Nota sobre o último item:** `AdminObservacoesModal` e `ScheduleModal` estão renderizados em `WaitingList/Index.tsx:577-595`, mas **não existe nenhum botão que chame `setShowContactModal(true)` ou `setShowScheduleModal(true)`**. Ambos os modais são inalcançáveis a partir da lista de espera. O endpoint `updateAdmin` (B-02) e o `ScheduleModal` estão, na prática, órfãos na UI.

---

### B-31 🟢 `WaitingListExport` — cabeçalho desalinhado

**Estado:** CONFIRMADO PELO CÓDIGO

A 10.ª coluna de dados é `nome_clinico`, mas o `headings()` diz `'Médico'` enquanto o `collection()` a rotula `'Nome Clínico'`. As restantes 9 correspondem. Menor, mas real.

Também: `WaitingListExport` não declara a propriedade `$data` (`public $data` em falta) — funciona por criação dinâmica de propriedade, **deprecated no PHP 8.2**.

---

## Parte B — Assumptions e Ambiguidades

### AM-01 — Semântica de `prioridade`

**Observado:** coluna `integer` nullable. Todas as ordenações usam `ORDER BY prioridade` **ascendente** e o valor aparece primeiro na chave de ordenação das posições. `WaitingListSeeder:30` gera valores 1-3.

**Interpretações possíveis:**
- (a) Menor valor = maior prioridade clínica (1 = urgente).
- (b) Maior valor = maior prioridade.

**Mais provável:** (a). A ordenação ascendente coloca os valores baixos no topo da lista, e o campo é usado como primeiro critério de posicionamento.

**Suporte:** `ExcelImportService:437-442`, `WaitingListController:42`. **Não há nenhum comentário, constante ou validação que confirme a escala.** [INFERIDO]

---

### AM-02 — Semântica de `estado` (`A`, `A1`, `F`, `C`)

**Observado:** o filtro por omissão é `estado = 'A'` (`WaitingListController:32`); o seeder gera `A` e `A1`; o importador morto exclui `F` e `C` do cálculo de posições.

**Interpretação mais provável:** `A`/`A1` = activo (variantes), `F` = fechado/finalizado, `C` = cancelado.

**Suporte:** apenas a exclusão em `ExcelChunkProcessor:238,261`, que está em código morto e nunca corre. O service activo **não filtra por `estado` de todo**. **[NÃO DETERMINÁVEL]** com confiança — o domínio pertence ao sistema hospitalar.

---

### AM-03 — Agrupamento de "patologia": `des_diagnostico` ou `patologia`?

**Observado:** dois `PARTITION BY` incompatíveis (B-15). O activo usa `LEFT(des_diagnostico,2)`; o morto usa `LEFT(patologia,2)`.

**Interpretações possíveis:**
- (a) `des_diagnostico` começa por um código (CID/ICD) cujos 2 primeiros caracteres identificam o capítulo → agrupamento por capítulo diagnóstico.
- (b) `patologia` é o campo correcto e `des_diagnostico` foi usado por engano.

**Mais provável:** (a), pela mesma técnica dos 2 caracteres aplicada em ambos os importadores e por `WaitingListSeeder:41` gerar `patologia` no formato `'P1 - Patologia Tipo 1'` (2 caracteres significativos: `P1`).

**Suporte:** `ExcelImportService:462` vs `ExcelChunkProcessor:234`. **A ambiguidade é real** — as duas implementações produzem agrupamentos diferentes. [NÃO DETERMINÁVEL] qual reflecte a regra de negócio pretendida.

---

### AM-04 — `waiting_list.team_id`: para que serve?

**Observado:** a coluna existe, tem FK, e as policies pretendem usá-la para restringir o acesso por equipa. Mas **nenhum fluxo da aplicação a escreve** — só o `WaitingListSeeder`.

**Interpretações possíveis:**
- (a) A atribuição de doentes a equipas seria feita manualmente numa funcionalidade ainda não implementada.
- (b) Seria derivada do Excel (por `patologia` ou `cod_medico`) numa regra ainda não escrita.
- (c) A coluna é vestigial.

**Mais provável:** (a) ou (b) — as policies de `WaitingList` dependem inteiramente dela, o que indica intenção. Mas com o bug B-01 e a ausência de escrita, **a restrição por equipa na lista de espera não existe no sistema actual**. [NÃO DETERMINÁVEL]

---

### AM-05 — `situacao_interna` vs `situacao`: como se reconciliam?

**Observado:** duas colunas de estado sobre o mesmo doente, com domínios diferentes e sem qualquer regra de coerência. Um doente pode ser `situacao = 'Operado'` (hospital) e `situacao_interna = 'Ativo'` (aplicação) em simultâneo.

**Interpretações possíveis:**
- (a) `situacao_interna` é deliberadamente independente — reflecte apenas o processo interno de convocatória, não o estado clínico.
- (b) Deveria existir uma regra que forçasse `situacao_interna` a um estado terminal quando `situacao` passa a `Operado`/`Cancelado`.

**Mais provável:** (a) é a implementação; (b) é provavelmente a intenção de negócio, dado que o import protege deliberadamente `situacao_interna` de ser sobrescrito.

**Suporte:** `getComparableFields()` exclui `situacao_interna` (decisão explícita); mas nenhuma regra de reconciliação existe. [INFERIDO]

---

### AM-06 — Papel pretendido da secretaria

**Observado:** `RolesSeeder:68-74` dá à secretaria `waiting_list.view/manage/export/import` + `teams.view`. Mas **não** `schedules.*`, `slots.*` nem `agenda.*`. Ao mesmo tempo, `SlotPolicy` e `SchedulePolicy` têm atalhos explícitos `if ($user->isSecretary()) return true;` em `update`, `delete` e `schedule`.

**Contradição:** as policies foram escritas assumindo que a secretaria teria as permissões de agendamento; o seeder não lhas dá. Os atalhos `isSecretary()` são, na configuração de raiz, **inalcançáveis** — a verificação `can('schedules.create')` falha antes.

**Mais provável:** a matriz do seeder está desactualizada face à intenção expressa nas policies. **[NÃO DETERMINÁVEL]** qual é a configuração de produção.

---

### AM-07 — `pernoita`: quem decide e quando?

**Observado:** `schedules.pernoita` ∈ {`sim`, `nao`, `talvez`}, default `nao`, obrigatório na criação e edição. Exibido com cores em `SlotModal.tsx:11-15`.

**Interpretação:** indica se o doente precisa de ficar internado após a cirurgia (relevante para planeamento de camas).

**Não determinável:** se `talvez` tem alguma consequência operacional, se existe momento em que deva ser convertido em `sim`/`nao`, e por que razão é obrigatório na criação quando muitas vezes só se sabe mais tarde. **Nenhuma regra usa este campo em cálculo algum.** [NÃO DETERMINÁVEL]

---

### AM-08 — Trocas de slots entre equipas

**Observado:** 5 colunas, 2 métodos de policy e a permissão `schedules.move`. Zero endpoints. A lógica de **leitura** (desvio da propriedade para `swapped_to_team_id`) está totalmente implementada em `SlotPolicy::schedule` e `SchedulePolicy::create`.

**Interpretação mais provável:** funcionalidade planeada e parcialmente implementada (modelo + autorização), com o fluxo de escrita (pedir → aprovar) por fazer.

**Regra de negócio inferida do que existe:**
> Uma equipa pode ceder o seu bloco a outra. Após a troca, quem agenda é a equipa receptora. O pedido parte de qualquer membro da equipa proprietária; a aprovação cabe ao líder da equipa proprietária.

**Suporte:** `SlotPolicy:63-68,71-89`, `SchedulePolicy:29-34`. [INFERIDO — o fluxo nunca foi executável]

---

### AM-09 — Limite de 20 000 registos para recálculo de posições

**Observado:** `shouldRecalculatePositions()` salta o recálculo acima de 20 000 registos, silenciosamente.

**Interpretação:** protecção contra o custo de dois `UPDATE` massivos com window functions.

**Ambiguidade:** não há qualquer mecanismo alternativo — nem job assíncrono, nem comando Artisan, nem aviso. Numa lista de espera hospitalar, 20 000 registos é uma dimensão perfeitamente plausível. **[NÃO DETERMINÁVEL]** o que se pretendia que acontecesse acima desse limite. O importador morto ao menos escrevia um `Log::warning`.

---

### AM-10 — Import: substituição ou fusão?

**Observado:** o import sobrescreve `observacoes_gerais` (vem do Excel) mas protege `observacoes_secretaria`. Sobrescreve `situacao` mas protege `situacao_interna`. Não toca em `team_id`, `posicao_*`, `created_at`/`updated_at`.

**Interpretação:** existe uma separação deliberada entre "campos do hospital" (autoridade do Excel) e "campos da aplicação" (autoridade local).

**Mais provável:** é uma regra de negócio real e intencional. **Não está documentada em lado nenhum do código** — está implícita na composição de `getComparableFields()`. Qualquer alteração a essa lista muda silenciosamente a fronteira de autoridade entre os dois sistemas. [INFERIDO com confiança alta]

---

### AM-11 — Registo público: intencional?

**Observado:** `/register` aberto, sem role nem equipa atribuídas. Num sistema com dados clínicos identificáveis.

**Interpretações possíveis:**
- (a) Resíduo do starter kit Laravel que ninguém removeu.
- (b) Fluxo deliberado: o utilizador regista-se e um admin atribui-lhe depois a role e a equipa.

**Mais provável:** (a). Não há nenhuma página de "conta pendente de aprovação", nenhuma flag de aprovação, e `UserController` já permite criar utilizadores completos. [INFERIDO]

---

### AM-12 — Alcance pretendido do `dashboard`

**Observado:** `/dashboard` é uma closure que renderiza uma página com quatro `PlaceholderPattern` — sem qualquer conteúdo. É a página de destino após o login e o alvo do logótipo da sidebar.

**[NÃO DETERMINÁVEL]** que indicadores se pretendia mostrar. Nenhuma métrica é calculada em lado nenhum do backend.

---

## Resumo por severidade

| Severidade | Contagem | IDs |
|---|---|---|
| 🔴 Crítica | 6 | B-01, B-02, B-03, B-08, B-12, B-17 |
| 🟠 Alta | 10 | B-04, B-05, B-06, B-07, B-10, B-14, B-15, B-18, B-19, B-23, B-27 |
| 🟡 Média | 8 | B-09, B-11, B-13, B-16, B-20, B-21, B-22, B-26 |
| 🟢 Baixa | 6 | B-24, B-25, B-28, B-29, B-30, B-31 |

**Achados de segurança** (documentados em `05 § 3`): S-1 a S-10, dos quais **S-1** (quatro rotas de negócio sem autenticação) e **S-2** (`/phpinfo` público) são críticos.
