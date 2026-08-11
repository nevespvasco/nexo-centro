# 07 — Error Handling, Edge Cases, Side Effects, Fluxos End-to-End e Observabilidade

---

## 1. Error Handling

### 1.1 Estratégia global

**Não existe tratamento de excepções personalizado.** `bootstrap/app.php:30-31` tem o bloco `withExceptions` vazio. Todo o comportamento é o do Laravel por omissão. [CONFIRMADO]

Não existe:
- nenhum `try/catch` em controllers ou policies [CONFIRMADO — grep];
- nenhum `rescue()`, `report()`, `renderable()`;
- nenhum mecanismo de retry, fallback ou circuit breaker;
- nenhuma página de erro personalizada (`resources/views/errors/` não existe).

Os **únicos `try/catch` do projecto** estão em `ExcelImportService::normalizeDate()` (linhas 384-393) e no seu gémeo morto `ExcelChunkProcessor::normalizeDate()`. Ambos capturam `\Exception` e **engolem o erro sem log**, devolvendo `null` (ou o valor original, no caso do morto). [CONFIRMADO]

### 1.2 Catálogo de condições excepcionais

Formato: **Condição → Onde ocorre → Como é detectada → Como é tratada → Resultado**

#### A. Validação

| # | Condição | Onde | Detecção | Tratamento | Resultado |
|---|---|---|---|---|---|
| A-1 | Campo obrigatório em falta | Todos os endpoints de escrita | `Request::validate` | `ValidationException` → 422 com `errors` | Inertia repopula `usePage().props.errors`; a maioria dos modais mostra a mensagem por campo |
| A-2 | `data_pretendida` não é futura | `pedirChamada` | `after:today` | 422 | `PedirChamadaModal` faz `setLoading(false)` mas **não mostra a mensagem** — o utilizador vê o botão reactivar-se sem explicação |
| A-3 | `resultado` fora de `ResultadoChamada` | `respostaChamada` | `Rule::enum` | 422 | `SecretariaRespostaModal` idem — sem exibição de erro |
| A-4 | `data_agendada` em falta com `resultado = 'Agendado'` | `respostaChamada` | `required_if` | 422 | idem |
| A-5 | Ficheiro não-xlsx | `import` | `mimes:xlsx` + verificação de extensão | 422 / `withErrors` | `Import.tsx:28` mostra `alert("Erro ao importar Excel")` |
| A-6 | `pernoita` omitido no cancelamento | `updateSchedule` via `EditScheduleModal` | `required|in:` | 422 | Toast de erro. **O cancelamento nunca funciona pela UI.** Ver `08 § B-19` |
| A-7 | `team_id` em falta para utilizador de equipa | `UserController::store/update` | `in_array` manual + `withErrors` | 302 com erro | Formulário repopulado |
| A-8 | E-mail duplicado | registo, `UserController` | `unique:users` | 422 | Mensagem no campo |

#### B. Autorização e autenticação

| # | Condição | Onde | Detecção | Tratamento | Resultado |
|---|---|---|---|---|---|
| B-1 | Sem sessão em rota `auth` | grupo `middleware(['auth'])` | Middleware | Redirect para `/login` | Testado em `DashboardTest` |
| B-2 | Sem permissão | `permission:` | Spatie middleware | `UnauthorizedException` → **403** | Página de erro genérica do Laravel |
| B-3 | Policy recusa | `$this->authorize()` | Gate | `AuthorizationException` → 403 | idem |
| B-4 | `abort(403)` explícito | `storeSchedule:195`, `updateSchedule:228` | manual | 403 | idem |
| B-5 | Excesso de tentativas de login | `LoginRequest` | `RateLimiter` (5) | `ValidationException` + evento `Lockout` | Mensagem `auth.throttle` com contagem decrescente |
| B-6 | Token CSRF expirado | middleware `web` | `TokenMismatchException` | 419 | Inertia recarrega a página |

#### C. Recursos inexistentes

| # | Condição | Onde | Detecção | Tratamento | Resultado |
|---|---|---|---|---|---|
| C-1 | Doente inexistente | `pedirChamada`, `updateSituacaoInterna`, `respostaChamada` | `findOrFail` | `ModelNotFoundException` → 404 | Página 404 |
| C-2 | Slot inexistente | `storeSchedule`, `updateSchedule` | `exists:slots,id` **e** `findOrFail` | 422 (validação apanha primeiro) | Mensagem no campo |
| C-3 | Chamada inexistente | `respostaChamada:58` | `if (!$call)` | `back()->with('error', ...)` | **Silencioso** — flash não lido |
| C-4 | Route-model binding sem correspondência | rotas com `{waitingList}`, `{slot}`, `{team}`, `{user}` | Laravel | 404 | Página 404 |
| C-5 | Página React inexistente (`Users/Show`) | `UserController::show` | — | Erro do Inertia no cliente | Ecrã em branco / erro na consola |
| C-6 | Método de controller inexistente (`slots/create`, `teams/{team}`, …) | `Route::resource` | `BadMethodCallException` | **500** | Stack trace se `APP_DEBUG=true` |

#### D. Erros de base de dados (não tratados — todos resultam em 500)

| # | Condição | Onde | Causa | Frequência |
|---|---|---|---|---|
| D-1 | `Unknown column 'equipa_id'` | `WaitingListController::export:248` | Coluna real é `team_id` | **Sempre**, para não-admin/não-secretaria |
| D-2 | `Unknown column 'contact_result'` | `updateAdmin:172` | Coluna não existe em `waiting_list_admin` | **Sempre** |
| D-3 | `Unknown column 'remember_token'` | login com "lembrar-me"; `NewPasswordController` | Coluna inexistente | Sempre que usada |
| D-4 | `Unknown column 'email_verified_at'` | `ProfileController::update` ao mudar e-mail | idem | Sempre |
| D-5 | FK RESTRICT ao apagar slot com agendamentos | `SlotController::destroy` | `schedules.slot_id` | Quando aplicável |
| D-6 | FK RESTRICT ao apagar utilizador líder / com agendamentos | `UserController::destroy`, `ProfileController::destroy` | `teams.leader_id`, `schedules.user_id` | Quando aplicável |
| D-7 | FK RESTRICT ao apagar equipa com membros/slots | `TeamController::destroy` | `users.team_id`, `slots.team_id` | Quando aplicável |
| D-8 | NOT NULL em `schedules.user_id` | `Schedule::creating` sem sessão | `auth()->id()` = null | Só se a rota deixasse de exigir auth |
| D-9 | Sintaxe MySQL em SQLite | `updatePositions` | `UPDATE ... LEFT JOIN` | Protegido por `if (getDriverName() === 'sqlite') return;` no service activo; **não protegido** no `ExcelChunkProcessor` (morto) |

#### E. Erros de enum (`ValueError`, não capturados)

| # | Condição | Onde | Impacto |
|---|---|---|---|
| E-1 | `situacao_interna` fora de `ResultadoChamada` | `WaitingList::getSituacaoColorAttribute` (em `$appends`) | **Rebenta qualquer serialização do model** — listagem, agenda, convocatórias |
| E-2 | `schedules.estado` fora de `ScheduleEstadoTypes` (ex.: `realizado` legado) | `Schedule::getEstadoCorAttribute` (em `$appends`) | Rebenta agenda, PDF e modal de slot |

Ambos são consequência de ter `$appends` com accessors que chamam `Enum::from()` sem `tryFrom()`. [CONFIRMADO]

#### F. Erros de parsing de datas

| # | Condição | Onde | Tratamento |
|---|---|---|---|
| F-1 | `?start=` ou `?month=` inválido na agenda | `AgendaController:22,27,106,157` | **Nenhum** — `Carbon::parse` lança `InvalidFormatException` → 500 |
| F-2 | Data inválida no Excel | `ExcelImportService::normalizeDate` | `catch` silencioso → `null` → **apaga a data existente** e gera histórico |
| F-3 | Serial Excel de época 1904 (ficheiro Mac) | idem | Nenhum — converte com 4 anos de desvio, sem erro |

#### G. Falhas de dependências externas

| # | Dependência | Falha | Tratamento |
|---|---|---|---|
| G-1 | Base de dados indisponível | `QueryException` | **Nenhum** — 500 |
| G-2 | DomPDF | Excepção na renderização | **Nenhum** — 500 |
| G-3 | Servidor de e-mail | Falha no envio de reset/verificação | Laravel por omissão (excepção). `MAIL_MAILER=log` em dev |
| G-4 | Memória PHP esgotada no import ou export | `AllowedMemorySizeExhausted` | **Nenhum** — 500. O import faz streaming (mitigado); o **export não** (`->get()` sem chunk) |
| G-5 | Timeout do servidor web durante o import | — | `set_time_limit(0)` desactiva o limite do PHP, **mas não o do Nginx/Apache/FPM** → 504 com o import a meio |

**Não existem timeouts, retries nem fallbacks configurados em lado nenhum.** [CONFIRMADO]

### 1.3 Rollbacks

| Operação | Rollback |
|---|---|
| `ExcelImportService::processBatch` | ✅ `DB::transaction` — rollback automático **por lote** |
| Todas as restantes escritas | ❌ **Sem transacção, sem rollback** |

**Consequência do rollback parcial no import:** se o lote 7 de 10 falhar, os lotes 1-6 ficam commitados. O utilizador vê um 500. Ao repetir o import, os lotes 1-6 são reprocessados: como os dados já coincidem, contam como `inalterados` e **não geram histórico duplicado** — a operação é, nesse aspecto, idempotente. Ver § 2.10.

---

## 2. Edge Cases

### 2.1 Dados nulos e vazios

| # | Caso | Comportamento | Confiança |
|---|---|---|---|
| 1 | `des_grupo` presente mas `null` no Excel | `isset()` devolve `false` → **filtro de serviço não aplicado** → linha importada mesmo não sendo de Cirurgia | [CONFIRMADO] |
| 2 | Coluna `DES_GRUPO` ausente da folha | Filtro não aplicado → **importa todos os serviços** | [CONFIRMADO] |
| 3 | `data_marcacao` nula | `updatePositions` ordena `data_marcacao IS NULL` → NULLs para o fim da fila | [CONFIRMADO] |
| 4 | `des_diagnostico` nulo | `LEFT(COALESCE(des_diagnostico,''),2)` → todos caem no mesmo grupo `''` | [CONFIRMADO] |
| 5 | `situacao_interna` nula (impossível via app — default de BD) | `ResultadoChamada::from(null)` → `TypeError` → 500 | [INFERIDO] |
| 6 | `user.team_id` nulo | `belongsToTeam(null)` → `false` → falha todas as verificações de propriedade | [CONFIRMADO] |
| 7 | `slot.team` nulo (impossível — FK NOT NULL) | `Semana.tsx:156` faria `slot.team.cor` rebentar | [INFERIDO] |
| 8 | `selected.contacts` indefinido | `AdminObservacoesModal.tsx:134` faz `.length` sem optional chaining → TypeError se a relação não vier carregada | [CONFIRMADO] |
| 9 | `repeat_until` nulo com `repeat_type ≠ 'none'` | `$date->gt(null)` → compara com "agora" → série longa se `data` for passada | [INFERIDO] |
| 10 | `sala` ausente do payload | Coluna NOT NULL sem default → erro SQL. O frontend envia sempre `''`, mascarando o problema | [CONFIRMADO] |

### 2.2 Dados duplicados

| # | Caso | Comportamento |
|---|---|---|
| 11 | Mesmo `id` repetido no ficheiro Excel, **dentro do mesmo lote** | Só a última linha é processada (`$buffer[$id] = $row`) |
| 12 | Mesmo `id` repetido em **lotes diferentes** | Ambas processadas → 2 UPDATEs + histórico contraditório |
| 13 | Import do **mesmo ficheiro** duas vezes | 2.ª vez: tudo `inalterado`, sem histórico. `insertOrIgnore` protege contra colisão de PK. **Idempotente** |
| 14 | Múltiplos `waiting_list_admin` para o mesmo doente | BD permite (sem unique); `hasOne` só lê um |
| 15 | Múltiplas `waiting_list_calls` para o mesmo doente | BD permite; `hasOne` devolve a **mais antiga** → guarda R-CH1 fica cega |
| 16 | Mesmo doente agendado em vários slots | **Permitido** — sem constraint nem validação |
| 17 | Duplicado exacto (`slot_id`, `waiting_list_id`) | **Permitido** — sem unique |
| 18 | Dois líderes na mesma equipa | Possível: `teams.leader_id` guarda um; a role `team_leader` fica em ambos |

### 2.3 Valores inesperados

| # | Caso | Comportamento |
|---|---|---|
| 19 | `schedules.estado = "qualquer coisa"` | Aceite (`required|string`), gravado, e depois **rebenta** no accessor `estado_cor` |
| 20 | `tipo_chamada = "XPTO"` | Aceite — o enum `TipoChamada` nunca é usado |
| 21 | `contact_result = "lorem ipsum"` | Aceite — sem domínio validado |
| 22 | `prioridade` não numérica no Excel | Gravada como string na coluna `integer` → MySQL converte para 0 (ou erro em strict mode) |
| 23 | `num_processo` numérico numa coluna de data | `is_numeric` → interpretado como serial Excel → data absurda, sem erro |
| 24 | `hora_fim < hora_inicio` | Aceite — sem validação |
| 25 | `data` do slot no passado | Aceite — sem validação |
| 26 | `duracao_estimada` maior que a duração do slot | Aceite — o campo nunca é usado em cálculos |
| 27 | `cor` de equipa com valor arbitrário | Aceite (`max:20`); `Semana.tsx:156` faz `slot.team.cor + '20'` (concatenação de string para alpha hex) → cor inválida se não for hex |

### 2.4 Requests repetidos e idempotência

| # | Operação | Idempotente? | Nota |
|---|---|---|---|
| 28 | `POST /waiting-list/import` (mesmo ficheiro) | ✅ Sim | 2.ª execução: 0 alterações, 0 histórico |
| 29 | `POST /waiting-list/{id}/pedir-chamada` | ❌ **Não** | Cria nova linha a cada chamada. A guarda R-CH1 falha após a 1.ª resposta |
| 30 | `POST /waiting-list/chamada/{id}/resposta` | ⚠️ Parcialmente | Repetível sem limite; sobrepõe `estado_anterior`, perdendo o histórico |
| 31 | `POST /waiting-list/{id}/situacao-interna` | ✅ Sim | Atribuição directa do mesmo valor |
| 32 | `POST /waiting-lists/{id}/admin` | ❌ **Não** | Cada envio cria novo `WaitingListContact` |
| 33 | `POST /waiting-lists/{id}/schedule` | ❌ **Não** | Duplo clique cria dois agendamentos. Sem chave de idempotência nem `disabled` no botão |
| 34 | `POST /slots` com repetição | ❌ **Não** | Recria toda a série |
| 35 | `PUT` de observações / equipas / slots | ✅ Sim | Atribuição directa |

**Nenhum endpoint aceita uma chave de idempotência.** [CONFIRMADO]

### 2.5 Operações concorrentes

Ver `02 § 5.3` para o catálogo completo (RC-1 a RC-6). Resumo dos casos com impacto de negócio:

| # | Caso | Impacto |
|---|---|---|
| 36 | Duas equipas convocam o mesmo doente em simultâneo | Duas convocatórias; a secretaria vê ambas |
| 37 | Duas secretarias respondem à mesma convocatória | A segunda sobrepõe; `estado_anterior` fica contaminado |
| 38 | Dois agendamentos no mesmo slot em simultâneo | Over-booking silencioso |
| 39 | Import a decorrer durante consulta da lista | Posições transitórias/NULL visíveis ao utilizador |
| 40 | Dois imports em paralelo | Histórico incoerente; `insertOrIgnore` evita colisão de PK mas não a incoerência de dados |

### 2.6 Recursos eliminados durante uma operação

| # | Caso | Comportamento |
|---|---|---|
| 41 | Doente apagado entre o `SELECT` e o `UPDATE` de `respostaChamada` | `findOrFail` → 404, mas o `UPDATE` da chamada **já foi commitado** (não há transacção) |
| 42 | Slot apagado enquanto um agendamento está a ser criado | FK falha → 500 |
| 43 | Utilizador apagado com convocatórias | `SET NULL` → convocatória sobrevive sem autor |
| 44 | Doente apagado (hipotético) | CASCADE apaga histórico, contactos, admin e convocatórias; RESTRICT em `schedules` bloqueia. **Contraditório** |
| 45 | Equipa apagada com slots | RESTRICT → 500 |

### 2.7 Dados parcialmente processados

| # | Caso | Comportamento |
|---|---|---|
| 46 | Import falha a meio | Lotes anteriores commitados; posições **não recalculadas** (o recálculo é a última operação) → estado com dados novos e posições antigas |
| 47 | Recálculo saltado por volume > 20 000 | **Silencioso** no service activo (sem log). Posições ficam indefinidamente desactualizadas |
| 48 | `updatePositions` executa e `updatePositionsByPatologia` falha | Duas posições calculadas em momentos diferentes, potencialmente incoerentes entre si |
| 49 | Série de slots interrompida a meio | Slots parciais criados, sem forma de identificar a série (metadados perdidos) |
| 50 | `updateAdmin`: contacto criado, estado não actualizado | Ocorre **sempre** (D-2) |

### 2.8 Dados antigos / obsoletos

| # | Caso | Comportamento |
|---|---|---|
| 51 | `schedules.estado = 'realizado'` (enum antigo) | `ValueError` no accessor → 500 |
| 52 | `waiting_list.data_agenda` do hospital vs `schedules` da aplicação | **Nunca reconciliados** — duas verdades sobre a mesma cirurgia |
| 53 | `posicao_lista` desactualizada após import parcial ou volume alto | Utilizador vê posições erradas, sem indicação |
| 54 | Doente `situacao = 'Operado'` mas `situacao_interna = 'Ativo'` | **Permitido** — continua convocável e visível na lista |
| 55 | Cache de permissões Spatie (24h) | Alterações de RBAC são invalidadas automaticamente pelo package; alterações **directas na BD** só produzem efeito 24h depois |

### 2.9 Casos de UI

| # | Caso | Comportamento |
|---|---|---|
| 56 | Slot ao sábado ou domingo | Criado, devolvido pelo backend e **nunca renderizado** (`Semana.tsx:45` só mostra Seg-Sex) |
| 57 | Slot de hoje | **Excluído** de `slotsDisponiveis` (comparação DATE vs DATETIME) |
| 58 | Botão "Limpar" filtros | Reactiva os filtros por omissão — não mostra a lista completa |
| 59 | Filtro `prioridade` no export | Enviado pelo frontend, **ignorado** pelo backend |
| 60 | Mais de 10 equipas | A paleta de cores repete-se (`$palette[$index % 10]`) |
| 61 | Criar/apagar equipa | Reatribui as cores de todas as equipas seguintes |
| 62 | `WaitingList::all()` com 50 000 registos | Carregado em memória a cada listagem e descartado (prop não consumida) |

### 2.10 Idempotência do import — análise detalhada

[CONFIRMADO — `ExcelImportService::processBatch`]

O import é **idempotente para dados idênticos**, por construção:

1. `insertOrIgnore` — colisão de PK não gera erro nem duplicado.
2. A comparação campo a campo classifica linhas iguais como `inalteradas` → sem UPDATE, sem histórico.
3. `updated_from_excel_at` só é escrito quando há alteração real.

**Mas não é idempotente para dados alterados entretanto:** se um utilizador editar `observacoes_secretaria` (campo protegido), o import não interfere. Se editar `situacao_interna` (protegido), idem. **Qualquer campo de `getComparableFields()` alterado manualmente na BD é revertido no import seguinte, com uma linha de histórico a registar a reversão** como se fosse alteração do hospital. Como nenhum desses campos é editável na aplicação, o cenário só ocorre com intervenção directa na BD. [CONFIRMADO]

---

## 3. Side Effects

### 3.1 Inventário completo

| # | Side effect | Quando ocorre | Condição | Fonte |
|---|---|---|---|---|
| SE-1 | `INSERT waiting_list` | Import | Linha passa nos filtros e o `id` não existe | `ExcelImportService:298` |
| SE-2 | `UPDATE waiting_list` | Import | Pelo menos um campo comparável mudou | `ExcelImportService:304` |
| SE-3 | `INSERT waiting_list_history` | Import | **Apenas o primeiro** campo alterado por linha | `ExcelImportService:314` |
| SE-4 | `UPDATE waiting_list.updated_from_excel_at` | Import | Junto com SE-2 | `ExcelImportService:280` |
| SE-5 | `UPDATE waiting_list.posicao_lista` (massivo) | Fim do import | MySQL **e** total ≤ 20 000 | `ExcelImportService:432` |
| SE-6 | `UPDATE waiting_list.posicao_patologia` (massivo) | idem | idem | `ExcelImportService:456` |
| SE-7 | `INSERT waiting_list_contacts` | `updateAdmin` | Sempre | `WaitingListController:163` |
| SE-8 | `UPDATE waiting_list_admin` | `updateAdmin` | Sempre — **falha sempre** | `WaitingListController:172` |
| SE-9 | `UPDATE waiting_list.observacoes_secretaria` | `updateObservacoesGerais` | Sempre | `WaitingListController:280` |
| SE-10 | `UPDATE waiting_list.situacao_interna` | `updateSituacaoInterna` **ou** `respostaChamada` | Sempre | `:296` / `:75` |
| SE-11 | `INSERT waiting_list_calls` | `pedirChamada` | Guarda R-CH1 não bloqueou | `WaitingListCallController:30` |
| SE-12 | `UPDATE waiting_list_calls` | `respostaChamada` | Chamada existe | `WaitingListCallController:63` |
| SE-13 | `INSERT schedules` | `storeSchedule` | Todas as autorizações passaram | `WaitingListController:198` |
| SE-14 | `UPDATE schedules` | `updateSchedule` | idem | `WaitingListController:231` |
| SE-15 | `INSERT slots` (1 a N) | `SlotController::store` | N depende de `repeat_type`/`repeat_until` | `SlotController:58,87` |
| SE-16 | `UPDATE`/`DELETE slots` | `update`/`destroy` | Policy passou | `SlotController:110,119` |
| SE-17 | `UPDATE teams.leader_id` | `UserController::store`/`update` | Role ∈ {team_leader, lider} **e** `team_id` presente | `UserController:56,91` |
| SE-18 | `assignRole` / `syncRoles` | `UserController::store`/`update` | Sempre | `UserController:53,88` |
| SE-19 | Invalidação da cache de permissões | Qualquer alteração de role/permissão | Automática (package) | Spatie |
| SE-20 | `UPDATE users.team_id` em massa | `TeamController::updateMembers` | **Método sem rota** | `TeamController:118-123` |
| SE-21 | Geração de ficheiro `.xlsx` em memória | `export` | Sempre | `WaitingListController:269` |
| SE-22 | Geração de PDF em memória | `exportPdf` | Sempre | `AgendaController:48` |
| SE-23 | Flash de sessão (`toast`/`success`/`error`) | Todas as escritas | Sempre | vários |
| SE-24 | Regeneração de sessão + token CSRF | login, logout, eliminação de conta | Sempre | Auth controllers |
| SE-25 | Evento `Illuminate\Auth\Events\Registered` | `POST /register` | Sempre — dispara tentativa de e-mail de verificação | `RegisteredUserController:45` |
| SE-26 | Evento `Illuminate\Auth\Events\Lockout` | 6.ª tentativa de login | Rate limit atingido | `LoginRequest:66` |
| SE-27 | E-mail de reset de password | `POST /forgot-password` | E-mail existe | Password broker |
| SE-28 | `set_time_limit(0)` no processo PHP | `import` | Sempre | `ExcelImportController:13` |
| SE-29 | `Log::warning` de recálculo adiado | `ExcelChunkProcessor::finalize` | **Código morto** | `ExcelChunkProcessor:170` |

### 3.2 Side effects que **não** existem (e poderiam esperar-se)

[CONFIRMADO — verificação exaustiva por grep]

| Esperado | Estado |
|---|---|
| E-mail ou SMS ao doente convocado | ❌ Não existe. `app/Notifications/` não existe. |
| Notificação à secretaria quando uma equipa pede chamada | ❌ Não existe |
| Notificação à equipa quando a secretaria responde | ❌ Não existe |
| Notificação de cirurgia agendada | ❌ Não existe |
| Escrita em `waiting_list.data_agenda` quando a secretaria agenda | ❌ Não existe |
| Criação automática de `Schedule` a partir de uma convocatória agendada | ❌ Não existe |
| Actualização de `situacao_interna` quando um `Schedule` passa a `operado` | ❌ Não existe |
| Fecho da convocatória quando o agendamento é criado | ❌ Não existe |
| Audit log de acções de utilizador | ❌ Não existe |
| Invalidação de cache aplicacional | ❌ Não existe cache aplicacional |
| Webhook para o sistema hospitalar | ❌ Não existe |
| Job assíncrono para o import | ❌ Não existe |

---

## 4. Eventos e Processamento Assíncrono

**Não existe processamento assíncrono no projecto.** [CONFIRMADO — verificação exaustiva]

| Mecanismo | Estado |
|---|---|
| Events de domínio | ❌ `app/Events/` não existe |
| Listeners | ❌ `app/Listeners/` não existe |
| Observers | ❌ Nenhum registado |
| Jobs / Queues | ❌ `app/Jobs/` não existe; nenhum `dispatch()`; nenhum `ShouldQueue` |
| Cron / Scheduler | ❌ `routes/console.php` só tem o comando `inspire` do starter kit; nenhum `Schedule::` |
| Comandos Artisan personalizados | ❌ Nenhum |
| Background workers | ❌ Nenhum. `composer dev` arranca `queue:listen` mas não há nada para consumir |
| Webhooks (entrada ou saída) | ❌ Nenhum |
| Triggers de BD | ❌ Nenhum nas migrações |
| Broadcasting / WebSockets | ❌ `BROADCAST_CONNECTION=log` |

**Os únicos eventos disparados** são os do framework, ambos em Auth: `Registered` (SE-25) e `Lockout` (SE-26). Nenhum tem listener personalizado.

**Hooks de model** — o único é `Schedule::booted()` com `static::creating` que força `user_id = auth()->id()` (`Schedule.php:25-32`). É síncrono e local. [CONFIRMADO]

---

## 5. Fluxos End-to-End

### F1 — Importação e sincronização da lista de espera

```
[Secretaria] escolhe ficheiro .xlsx em /waiting-list/import
   │
   ├─ POST multipart → auth ✓ → permission:waiting_list.import ✓
   ├─ Validação: mimes:xlsx ✓ + extensão original ✓
   ├─ set_time_limit(0)
   │
   ├─ ExcelImportService::import() — streaming por linha
   │     ├─ Mapeamento de cabeçalhos (aliases)
   │     ├─ Filtro: des_grupo = 'HSA - Cirurgia' (se a coluna existir)
   │     ├─ Filtro: id > 0
   │     ├─ Normalização de 4 datas
   │     └─ Buffer indexado por id (de-duplicação: última vence)
   │
   ├─ A cada 1000 linhas → processBatch()
   │     ├─ SELECT existentes (whereIn id)
   │     ├─ Decisão INSERT | UPDATE | NO-OP
   │     ├─ Comparação normalizada, EARLY EXIT no 1º campo diferente
   │     └─ DB::transaction { insertOrIgnore + upsert + insert histórico }
   │
   ├─ shouldRecalculatePositions()?
   │     ├─ MySQL? e total ≤ 20 000?
   │     ├─ SIM → UPDATE posicao_lista (todos os registos)
   │     │      → UPDATE posicao_patologia (excluindo Operado/Cancelado)
   │     └─ NÃO → salta SILENCIOSAMENTE
   │
   ├─ Estatísticas devolvidas → DESCARTADAS
   └─ 302 back + flash 'success' (não lido) → alert("Importação concluída")

DECISÕES: 5 filtros de linha · 1 decisão INSERT/UPDATE/NO-OP por registo
          · 1 gate de recálculo de posições
SIDE EFFECTS: SE-1..SE-6, SE-28
NÃO ACONTECE: notificações, logs, criação de agendamentos, alteração de situacao_interna
```

### F2 — Convocatória de doente (fluxo de negócio central)

```
[Equipa cirúrgica] abre /waiting-lists, filtra, clica "Convocar"
   │  (botão só activo se situacao_interna === 'Ativo' — regra só no cliente)
   │
   ├─ PedirChamadaModal: tipo_chamada, data_pretendida, observações
   │
   ├─ POST /waiting-list/{id}/pedir-chamada     ⚠ SEM AUTENTICAÇÃO
   │     ├─ Validação: data_pretendida > hoje ✓
   │     ├─ findOrFail(doente)
   │     ├─ GUARDA: doente->call->estado_novo ∈ {Suspenso, Agendado, Operado}?
   │     │      → SIM: back()->with('error') — INVISÍVEL na UI, parece sucesso
   │     └─ INSERT waiting_list_calls { estado_novo: 'Suspenso', pedido_por_user_id: auth()->id() }
   │            ⚠ waiting_list.situacao_interna NÃO é alterado
   │
   └─ toast "Convocatória criada com sucesso — Doente colocado em suspensão"
          ⚠ afirmação falsa: o doente continua 'Ativo' e convocável de novo
   │
   ▼
[Secretaria] abre /waiting-list/chamadas/pendentes     ⚠ SEM AUTENTICAÇÃO
   │     ├─ SELECT WHERE resultado IS NULL  → devolve TODAS as convocatórias de sempre
   │     ├─ N+1: 2 queries por linha (doente + utilizador)
   │     └─ Filtros de tipo/data aplicados só no cliente
   │
   ├─ Clica "Editar" (nunca "Responder" — jaRespondida é sempre true)
   │
   ├─ SecretariaRespostaModal: resultado, data_agendada (se 'Agendado'), observações
   │     ⚠ o campo pré-preenchido com estado_novo='Suspenso' não existe na lista de opções
   │
   ├─ POST /waiting-list/chamada/{callId}/resposta      ⚠ SEM AUTENTICAÇÃO
   │     ├─ Validação: resultado ∈ ResultadoChamada; data_agendada se Agendado
   │     ├─ (1) UPDATE waiting_list_calls
   │     │        estado_anterior ← estado_novo actual
   │     │        estado_novo ← resultado
   │     │        secretaria_user_id, secretaria_em, data_agendada, observacoes_secretaria
   │     │        ⚠ coluna `resultado` NÃO escrita → continua "pendente" para sempre
   │     ├─ (2) findOrFail(doente)
   │     └─ (3) doente.situacao_interna ← resultado ; save()
   │            ⚠ (1) e (3) não são transaccionais
   │
   └─ toast "Sucesso"
   │
   ▼
[Lista de espera] o badge de situação interna muda de cor
   Se resultado = 'Ativo' → doente volta a ser convocável
   Se resultado = 'Agendado' → botão "Convocar" fica desactivado
       ⚠ mas NENHUM Schedule é criado — o agendamento real é um fluxo separado
```

### F3 — Agendamento cirúrgico

```
[Admin] abre /agenda/semana (ou /slots)
   │     ├─ permission:agenda.view ✓
   │     ├─ Slots da semana Seg→Dom, com schedules ≠ 'cancelado'
   │     └─ waitingLists: doentes sem schedule 'agendado'/'confirmado'
   │            ⚠ sem limite; 'confirmado' não existe; 'operado' não é excluído
   │
   ├─ Clica num slot → SlotModal → "Adicionar" → CreateScheduleModal
   │
   ├─ POST /waiting-lists/{waiting_list_id}/schedule
   │     ├─ permission:schedules.create ✓
   │     ├─ WaitingListPolicy::update → waiting_list.manage ✓
   │     ├─ SlotPolicy::schedule → schedules.create + propriedade do slot
   │     │      (slot trocado → equipa receptora; senão → equipa proprietária)
   │     │      ⚠ só o admin reúne as três condições na config de raiz
   │     ├─ Validação: slot_id exists; pernoita in:sim,nao,talvez
   │     │             estado required|string  ⚠ SEM validação de enum
   │     ├─ Schedule::creating → user_id forçado a auth()->id()
   │     └─ INSERT schedules
   │            ⚠ sem verificação de capacidade do slot
   │            ⚠ sem verificação de duplicado
   │            ⚠ sem verificação de que o doente já está operado
   │
   ├─ onSuccess → router.reload({ only: ['agenda'] })
   │            → useEffect sincroniza o SlotModal aberto
   │
   └─ Agendamento visível na agenda (semana, mês, slots) e no PDF
          ⚠ NÃO escreve waiting_list.data_agenda
          ⚠ NÃO altera situacao_interna
          ⚠ NÃO fecha nenhuma convocatória
```

### F4 — Registo de contacto administrativo

```
[Secretaria] abre AdminObservacoesModal a partir da lista de espera
   ├─ canEdit = permissions.includes('waiting_list.manage')
   │
   ├─ POST /waiting-lists/{id}/admin
   │     ├─ permission:waiting_list.manage ✓
   │     ├─ WaitingListPolicy::update ✓ (admin/secretaria)
   │     ├─ Validação: data_contacto, contactado_por, contact_result obrigatórios
   │     ├─ (1) INSERT waiting_list_contacts        ✓ sucesso
   │     └─ (2) UPDATE waiting_list_admin ...       ✗ ERRO SQL SEMPRE
   │             (coluna contact_result não existe nessa tabela)
   │
   └─ 500. Ao recarregar, o contacto de (1) aparece no histórico.
          ⚠ waiting_list_admin.contactado permanece false para sempre
```

### F5 — Criação de blocos operatórios com repetição

```
[Admin] /slots → "Criar Slot"
   ├─ POST /slots
   │     ├─ SlotPolicy::create → slots.create ✓
   │     ├─ Validação: data, horas, team_id, repeat_type
   │     │      ⚠ sem validação hora_fim > hora_inicio
   │     │      ⚠ repeat_until não é obrigatório mesmo com repeat_type ≠ none
   │     ├─ Slot::create($data)
   │     │      ⚠ repeat_type e repeat_until DESCARTADOS (fora de $fillable)
   │     ├─ repeat_type = 'none' → fim
   │     └─ while(true): addDay/Week/Month → if > repeat_until break → Slot::create
   │            ⚠ sem transacção · sem limite máximo
   │            ⚠ repeat_until null + data passada → série longa até hoje
   │
   └─ 302 + flash 'success' (não lido pelo frontend)
```

---

## 6. Observabilidade

### 6.1 Logging

| Aspecto | Estado |
|---|---|
| Canal | `stack` → `single` (`storage/logs/laravel.log`) |
| Nível | `debug` |
| Logs de domínio | **Um único**, em código morto (`ExcelChunkProcessor:170`) |
| Logs no service de import activo | **Nenhum** |
| Logs de autorização / autenticação | Só os do framework |
| Logs de erro | Automáticos do Laravel para excepções não capturadas |
| Correlação de pedidos | Nenhuma (sem request id / trace id) |

[CONFIRMADO — grep por `Log::` devolve apenas `ExcelChunkProcessor.php`]

### 6.2 Métricas e tracing

| Aspecto | Estado |
|---|---|
| Métricas de aplicação | ❌ Nenhuma |
| APM / tracing distribuído | ❌ Nenhum |
| Laravel Telescope | ❌ Não instalado (só referenciado como desactivado no `phpunit.xml`) |
| Laravel Pulse | ❌ Não instalado (idem) |
| Health check | ✅ `/up` (Laravel, `bootstrap/app.php:16`) — verifica só se a app arranca |
| Monitorização do import | ❌ As estatísticas são calculadas e descartadas |

### 6.3 Informação disponível para diagnóstico

| Fonte | Conteúdo | Limitações |
|---|---|---|
| `waiting_list_history` | Alterações vindas do Excel | **Incompleto** (só o 1.º campo por linha); nunca lido pela aplicação |
| `waiting_list.updated_from_excel_at` | Último import que alterou o registo | Só existe se houve alteração |
| `waiting_list_calls` | `pedido_em`, `secretaria_em`, `estado_anterior` | 1 nível de histórico; utilizadores nullable |
| `waiting_list_contacts` | Histórico completo de contactos | `contactado_por` é string livre, não FK |
| `schedules.user_id` + `created_at` | Quem criou o agendamento e quando | Não regista quem **alterou** |
| `sessions` | Sessões activas, IP, user agent | — |
| `failed_jobs` | — | Sempre vazia (não há jobs) |
| `storage/logs/laravel.log` | Excepções | Sem contexto de negócio |

### 6.4 O que **não** é possível diagnosticar

[CONFIRMADO]

- Quem alterou `situacao_interna` de um doente e quando (o `save()` actualiza `updated_at`, mas sem autor).
- Quem editou `observacoes_secretaria`.
- Quem exportou dados de doentes, quando e com que filtros.
- Que alterações completas um import fez (só o primeiro campo de cada linha é registado).
- Quantas linhas um import processou, ignorou ou rejeitou.
- Quem alterou roles ou permissões.
- Quem apagou um slot, uma equipa ou um utilizador.
- Se o recálculo de posições correu ou foi saltado.
- Que estado tinha um agendamento antes de ser alterado.

### 6.5 CI

[CONFIRMADO — `.github/workflows/`]

| Workflow | Conteúdo |
|---|---|
| `tests.yml` | Executa a suite Pest |
| `lint.yml` | Laravel Pint (PHP) + ESLint/Prettier (JS) |

**Cobertura de testes real:** 8 ficheiros de teste, todos do starter kit Laravel (auth, settings, dashboard, exemplos). **Zero testes para o domínio** — nenhum teste de lista de espera, import, convocatórias, slots, agendamentos, agenda, equipas ou policies. [CONFIRMADO — `tests/`]

Além disso, `UserFactory` escreve `email_verified_at` e `remember_token`, colunas inexistentes → **é expectável que toda a suite que crie utilizadores falhe**. [INFERIDO — não executado nesta análise]
