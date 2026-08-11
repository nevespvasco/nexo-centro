# 03 — Business Logic por Módulo

Formato usado em cada fluxo:
**Input → Validações → Regras de negócio → Decisões → Efeitos/Side Effects → Output**

---

## M2. Importação de Excel (o fluxo mais complexo do sistema)

**Entrada:** `POST /waiting-list/import` · **Controller:** `ExcelImportController::import` · **Service:** `App\Services\ExcelImportService`

> Este é o único módulo com uma camada de serviço real e concentra a maior densidade de regras implícitas do projecto.

### 2.1 Pré-condições

| # | Pré-condição | Fonte |
|---|---|---|
| P1 | Utilizador autenticado (`middleware auth`) | `routes/web.php:18,27` |
| P2 | Permissão `waiting_list.import` | `routes/web.php:28` |
| P3 | Ficheiro presente, MIME `xlsx` | `ExcelImportController:16-18` |
| P4 | Extensão do nome original = `xlsx` (dupla verificação) | `ExcelImportController:21-25` |
| P5 | Driver de BD **MySQL** para que as posições sejam recalculadas | `ExcelImportService:428,450` |

### 2.2 Fluxo completo

```
Input: ficheiro .xlsx
  │
  ├─ set_time_limit(0); ini_set('max_execution_time', 0)      ← sem limite de tempo
  │
  ├─ Validação: required|file|mimes:xlsx
  ├─ Validação redundante: extensão original === 'xlsx'
  │
  ├─ SimpleExcelReader::create($path,'xlsx')->getRows()  (generator, streaming)
  │
  └─ POR CADA LINHA:
        │
        ├─ normalizeRow()
        │    ├─ R1. Mapeamento de cabeçalhos (headerMap, 33 aliases → 21 campos)
        │    │      Colunas não mapeadas são DESCARTADAS SILENCIOSAMENTE.
        │    ├─ R2. FILTRO DE SERVIÇO: se a coluna des_grupo existir na folha
        │    │      e o seu valor (case-insensitive) ≠ 'HSA - Cirurgia' → linha ignorada.
        │    │      Se a coluna NÃO existir → nenhum filtro é aplicado.
        │    ├─ R3. FILTRO DE ID: (int)id <= 0 → linha ignorada.
        │    └─ R4. Normalização de datas (4 campos) e cópia de 16 campos simples.
        │
        ├─ R5. DE-DUPLICAÇÃO POR ID DENTRO DO FICHEIRO:
        │      $buffer[$id] = $row  → linhas repetidas: a ÚLTIMA vence.
        │
        └─ Quando buffer atinge 1000 (DEFAULT_BATCH_SIZE) → processBatch()
  │
  ├─ processBatch() final para o resto do buffer
  │
  └─ shouldRecalculatePositions() ? updatePositions() + updatePositionsByPatologia() : nada
  │
Output: redirect back com flash 'success' = "Arquivo importado com sucesso."
        (as estatísticas devolvidas pelo service são DESCARTADAS)
```

### 2.3 Regra R1 — Mapeamento de cabeçalhos

[CONFIRMADO — `ExcelImportService.php:16-52`]

O `headerMap` aceita múltiplos aliases por campo, reflectindo variações entre exportações do sistema hospitalar:

| Campo interno | Aliases aceites no Excel |
|---|---|
| `id` | `Nº LISTA`, `NUM_LISTA`, `LISTA`, `NUM_LISTA_ESPERA` |
| `data_marcacao` | `DTA_INSCR`, `DTA_TMRG`, `DATA_INSCRICAO`, `DTA_MARCACAO` |
| `data_agenda` | `DTA_AGEN`, `DATA_AGENDA` |
| `prioridade` | `PRIORIDADE`, `PR` |
| `regime` | `Regime`, `Regim` |
| `situacao` | `Situacao`, `SITUACAO` |
| `des_diagnostico` | `DES_DIAGNOSTICO`, `DES_DIAGNOSTIC` |
| `nome_clinico` | `NOME_CLINICO`, `NOME_CLIN` |
| `observacoes_gerais` | `OBSERVACOES`, `OBSER` |
| `num_processo` | `NUM_PROCESSO`, **`UTENTE`** |
| restantes | nome único (`ESTADO`, `DTA_OPERADO`, `SEXO`, `DES_GRUPO`, `DTA_CANCEL`, `CANCEL`, `DES_CANCEL`, `PATOLOGIA`, `COD_MEDICO`, `INTERV_CIRURGICA`, `NOME`) |

**Regras implícitas:**
- **Case-sensitive.** `PRIORIDADE` funciona, `Prioridade` não. Excepção: `Regime`/`Regim` e `Situacao` estão em mixed case propositadamente.
- **Só o nome é `trim`ado** (`$key = trim((string)$colName)`, linha 109) — espaços à volta são tolerados, diferenças de maiúsculas não.
- **Uma coluna com cabeçalho desconhecido é ignorada sem aviso nem log.** Um ficheiro totalmente errado importa 0 linhas e mostra "Arquivo importado com sucesso."
- Se dois aliases do mesmo campo aparecerem na mesma folha, **o último na ordem das colunas vence** (sobreposição no `$normalizedRow`).

### 2.4 Regra R2 — Filtro de serviço `HSA - Cirurgia`

[CONFIRMADO — `ExcelImportService.php:116-121`]

```php
if (isset($normalizedRow['des_grupo'])) {
    $desGrupo = $this->normalizeString($normalizedRow['des_grupo'] ?? null);
    if (strtolower($desGrupo) !== strtolower(self::SERVICE_GROUP)) { return null; }
}
```

| Situação | Comportamento |
|---|---|
| Coluna `DES_GRUPO` presente e = `HSA - Cirurgia` (qualquer caixa) | Linha aceite |
| Coluna presente e ≠ | Linha **descartada** |
| Coluna presente mas **vazia/null** | `isset()` sobre chave existente com valor `null` devolve `false` → **filtro não é aplicado** → linha **aceite**. [CONFIRMADO — comportamento de `isset` com `null`] |
| Coluna **ausente** da folha | Filtro não aplicado → **todas as linhas aceites**, incluindo de outros serviços |

**Contradição com o outro importador:** `ExcelChunkProcessor:32,49` compara com a string literal `"HSA - CIRURGIA"` (maiúsculas, comparação estrita `!==`) sobre a **coluna posicional 10**. O `WaitingListSeeder:38` também usa `'HSA - CIRURGIA'`. Três representações diferentes da mesma constante de negócio. [CONFIRMADO]

### 2.5 Regra R4 — Normalização de datas

[CONFIRMADO — `ExcelImportService::normalizeDate():356-396`]

Ordem de tentativas (primeira que resolve, ganha):

1. Valor falsy (`null`, `''`, `0`, `'0'`) → `null`
2. `DateTimeInterface` → `Y-m-d`
3. **Numérico → serial Excel:** `Carbon::createFromTimestamp(($value - 25569) * 86400)`
4. String vazia após `trim` → `null`
5. Regex `^\d{4}-\d{2}-\d{2}$` → devolve tal e qual
6. Regex `^\d{4}-\d{2}-\d{2}\s` → primeiros 10 caracteres
7. Contém `/` → `Carbon::createFromFormat('d/m/Y', ...)` (formato **português**)
8. `Carbon::parse()` genérico
9. Falha total → **`null`**

**Regras implícitas e riscos:**
- **Épocas Excel:** a fórmula `-25569` assume a época 1900 do Windows. Ficheiros gerados no Mac (época 1904) ficam com datas **4 anos adiantadas**, sem erro. [CONFIRMADO pela fórmula]
- `25569` = dias entre 1899-12-30 e 1970-01-01.
- O passo 3 corre **antes** de qualquer verificação de intervalo — um `num_processo` numérico colocado por engano numa coluna de data produz uma data absurda silenciosamente.
- Passo 7 assume `d/m/Y`. Um ficheiro em `m/d/Y` produz datas trocadas ou, se o dia > 12, é apanhado pelo `catch` e cai para `Carbon::parse()` (passo 8), que usa heurística **americana** → resultado inconsistente entre linhas do mesmo ficheiro. [INFERIDO — comportamento documentado do Carbon]
- **Data inválida vira `null`, não erro.** Uma data corrompida apaga a data existente na BD (o `upsert` escreve `null`) e gera uma linha de histórico. Não há qualquer aviso.
- **Divergência com `ExcelChunkProcessor::normalizeDate():219`** — este devolve `$value` (a string original) em caso de falha, em vez de `null`. Comportamentos opostos entre os dois importadores.

### 2.6 Regra R5 — De-duplicação dentro do ficheiro

[CONFIRMADO — `ExcelImportService.php:83`] `$buffer[$normalizedRow['id']] = $normalizedRow;`

Se o mesmo `NUM_LISTA_ESPERA` aparecer várias vezes no ficheiro, **só a última ocorrência é processada**. As anteriores são descartadas sem registo. Não há detecção nem contagem de duplicados.

**Nota:** a de-duplicação só actua **dentro do mesmo lote de 1000**. Se a linha 500 e a linha 1500 tiverem o mesmo id, ficam em lotes diferentes e ambas são processadas — a segunda gera um UPDATE e uma linha de histórico contra a primeira.

### 2.7 Regra de decisão INSERT vs UPDATE vs NO-OP

[CONFIRMADO — `ExcelImportService::processBatch():214-288`]

```
Para cada linha do lote:
  │
  ├─ Existe na BD? (lookup no SELECT por whereIn feito no início do lote)
  │
  ├─ NÃO → toInsert[]  ; stats.importados++      (sem histórico)
  │
  └─ SIM → comparação campo a campo sobre getComparableFields() (18 campos)
             │
             ├─ Normalização por tipo:
             │     campo de data  → normalizeDate() nos dois lados
             │     outros         → normalizeString() = trim((string)$v), null→''
             │
             ├─ Comparação ESTRITA (!==) de strings
             │
             ├─ Primeira diferença encontrada:
             │      changed = true
             │      history[] = { campo, valor_antigo, valor_novo, alterado_em, origem:'excel' }
             │      break   ←──── EARLY EXIT
             │
             ├─ changed → toUpdate[] ; updated_from_excel_at = now() ; stats.atualizados++
             └─ !changed → stats.inalterados++
```

**Regra crítica implícita — o `break` da linha 275 [CONFIRMADO]:**

O ciclo de comparação termina na **primeira** diferença. Consequências:

1. Se uma linha tiver 5 campos alterados, o `upsert` grava **os 5**, mas o histórico regista **apenas 1** — o primeiro na ordem de `getComparableFields()`.
2. A ordem de detecção é fixa: `data_marcacao, data_agenda, data_operado, data_cancel, prioridade, regime, situacao, estado, num_processo, nome_clinico, des_diagnostico, observacoes_gerais, sexo, des_grupo, cancel, des_cancel, patologia, nome`.
3. Uma alteração de `situacao` (7ª) só é registada se nenhum dos 6 campos anteriores tiver mudado.
4. **A auditoria é estruturalmente incompleta.** O comentário no código (`// ⚡ early exit → 20× mais rápido`) mostra que foi uma optimização de desempenho; o efeito no domínio (auditoria clínica) não parece ter sido considerado. Ver `08 § B-12`.

O importador Python (`python/import_excel.py:207-219`) e o `ExcelChunkProcessor:85-103` — ambos não usados — **registam todos os campos alterados**, sem `break`. O comportamento correcto está implementado nos ficheiros mortos.

**Campos comparados vs campos escritos [CONFIRMADO]:**
- `getComparableFields()` (18 campos) exclui `cod_medico` e `interv_cirurgica`, que são lidos em `normalizeRow` mas depois **filtrados por `array_intersect_key`** (linha 219). Logo, `cod_medico` e `interv_cirurgica` **nunca são escritos por este importador** — nem em INSERT nem em UPDATE. Chegam a estar no `$normalizedRow` e são deitados fora. Ver `08 § B-13`.

**Campos protegidos do import (nunca sobrescritos):** `situacao_interna`, `observacoes_secretaria`, `posicao_lista`, `posicao_patologia`, `team_id`, `created_at`, `updated_at`. [CONFIRMADO — não constam de `getComparableFields()`]

### 2.8 Persistência do lote

[CONFIRMADO — `ExcelImportService.php:294-317`] — **única transacção do projecto**

```php
DB::transaction(function () {
    if ($toInsert) DB::table('waiting_list')->insertOrIgnore($toInsert);
    if ($toUpdate) DB::table('waiting_list')->upsert($toUpdate, ['id'], $updateColumns);
    foreach (array_chunk($history, 5000) as $chunk)
        DB::table('waiting_list_history')->insert($chunk);
});
```

| Aspecto | Nota |
|---|---|
| `insertOrIgnore` | Colisões de PK são ignoradas silenciosamente (defesa contra corrida entre imports). |
| `upsert` colunas | `array_diff(array_keys($toUpdate[0]), ['id'])` — usa as chaves **da primeira linha** do lote como referência para todas. Se as linhas tiverem conjuntos de campos diferentes (possível, porque `normalizeRow` só copia campos presentes), o `upsert` fica mal formado. [CONFIRMADO — linha 302] |
| `created_at`/`updated_at` | **Não são preenchidos** — `DB::table()` ignora timestamps do Eloquent. Registos novos ficam com `created_at = NULL`. |
| Atomicidade | Por lote, não por ficheiro. |
| Eventos Eloquent | **Não disparam** — `DB::table()` bypassa o model. Nenhum observer/mutator/cast é aplicado. |

### 2.9 Recálculo de posições

[CONFIRMADO — `ExcelImportService.php:411-474`]

**Gate `shouldRecalculatePositions()`:**
```php
if (!hasColumn('posicao_lista') && !hasColumn('posicao_patologia')) return false;   // AND, não OR
$limit = (int)(getenv('EXCEL_IMPORT_POSITION_RECALC_LIMIT') ?: 20000);
return DB::table('waiting_list')->count() <= $limit;
```
- Usa `&&` sobre negações → só desiste se **as duas** colunas faltarem. Se só uma existir, tenta as duas queries.
- Acima de 20 000 registos **o recálculo é silenciosamente saltado** — sem log, sem aviso ao utilizador. Posições ficam desactualizadas indefinidamente. (O `ExcelChunkProcessor:170` faz `Log::warning` neste caso; o service activo não.)
- `getenv()` não lê o `.env` do Laravel → o limite é sempre 20 000 na prática.

**`updatePositions()` — posição absoluta:**
```sql
UPDATE waiting_list wl
LEFT JOIN (SELECT id, ROW_NUMBER() OVER (
             ORDER BY prioridade,
                      data_marcacao IS NULL,     -- NULLs no fim
                      data_marcacao,
                      id                          -- desempate determinístico
           ) AS rn
           FROM waiting_list) ranked ON ranked.id = wl.id
SET wl.posicao_lista = ranked.rn
```
**Fórmula de ordenação:** `prioridade` ASC (menor = mais prioritário) → doentes com `data_marcacao` preenchida antes dos que a têm nula → `data_marcacao` ASC (mais antigo primeiro) → `id` ASC como desempate.

**Regra implícita crítica:** **não há cláusula `WHERE`** — doentes operados, cancelados ou com `estado = 'F'`/`'C'` **recebem posição na lista absoluta**. [CONFIRMADO]

**`updatePositionsByPatologia()` — posição relativa:**
```sql
... ROW_NUMBER() OVER (
      PARTITION BY LEFT(COALESCE(des_diagnostico,''), 2)
      ORDER BY prioridade, data_marcacao IS NULL, data_marcacao, id)
    FROM waiting_list
    WHERE situacao NOT IN ('Operado','Cancelado')
```

**Regras implícitas [CONFIRMADO]:**
- O agrupamento por "patologia" é feito pelos **2 primeiros caracteres de `des_diagnostico`**, não pela coluna `patologia`. É um proxy do código CID/ICD. Dois diagnósticos diferentes que comecem pelos mesmos 2 caracteres partilham fila.
- `COALESCE(...,'')` → todos os diagnósticos nulos caem num único grupo `''`.
- Filtra `situacao NOT IN ('Operado','Cancelado')` — comparação **case-sensitive**, com valores hard-coded que não existem em nenhum enum.
- Registos excluídos pelo `WHERE` ficam com `posicao_patologia = NULL` (efeito do `LEFT JOIN` sem correspondência) — **a exclusão limpa a posição anterior**.

**Contradição com o importador morto [CONFIRMADO]:** `ExcelChunkProcessor` usa `PARTITION BY LEFT(COALESCE(patologia,''),2)` (coluna `patologia`, não `des_diagnostico`) e adiciona `WHERE estado NOT IN ('F','C')` a **ambas** as queries. Duas definições incompatíveis da mesma regra de negócio. Ver `08 § B-15`.

### 2.10 Output e observabilidade

| Aspecto | Comportamento |
|---|---|
| Estatísticas | `ExcelImportService::import()` devolve `['importados','atualizados','inalterados']`, mas `ExcelImportController:28` **descarta o valor de retorno**. |
| Mensagem ao utilizador | Sempre `'Arquivo importado com sucesso.'` via `->with('success', ...)` — que **não é lido pelo frontend** (`share()` só expõe `toast`). |
| Frontend | `WaitingList/Import.tsx:27-28` mostra `alert("Importação concluída")` em `onSuccess` e `alert("Erro ao importar Excel")` em `onError`. Um import que processe 0 linhas mostra "Importação concluída". |
| Logs | **Nenhum.** O service activo não escreve nada em log. |

---

## M1. Lista de Espera — Consulta e edição

### 1.1 Listagem — `GET /waiting-lists`

[CONFIRMADO — `WaitingListController::index():22-99`]

```
Input: query params (num_processo, situacao[], estado, prioridade, des_diagnostico)
  │
  ├─ authorize('viewAny', WaitingList::class) → requer waiting_list.view
  │
  ├─ R-LE1. FILTROS POR OMISSÃO (aplicados por merge no Request):
  │      se situacao vazio → ['Readmitido','Inscrito','Pre-Inscrito','Transferido Para']
  │      se estado  vazio → ['A']
  │
  ├─ Query paginada (20/página) com eager load: admin, schedule, contacts, call
  │      num_processo    → igualdade exacta
  │      situacao        → whereIn (array)
  │      estado          → where (=)  ← recebe array; Laravel usa só o 1º elemento
  │      prioridade      → igualdade exacta
  │      des_diagnostico → LIKE %valor%
  │      ORDER BY data_marcacao ASC
  │
  ├─ Opções dos dropdowns: SELECT DISTINCT situacao / estado / prioridade
  ├─ equipaOptions: todas as equipas, ou só a do utilizador se não for admin/secretaria
  ├─ slotsDisponiveis: slots com data >= now() e is_swapped = false,
  │       restritos à equipa do utilizador se não for admin/secretaria
  ├─ $lista = WaitingList::all() → tabela inteira (prop nunca consumida)
  │
Output: Inertia 'WaitingList/Index' com waitingLists, opções, permissions, resultados, filters
```

**R-LE1 — Filtros por omissão [CONFIRMADO — linhas 27-33]:**

```php
if (!$request->situacao) { $request->merge(['situacao' => ['Readmitido','Inscrito','Pre-Inscrito','Transferido Para']]); }
if (!$request->estado)   { $request->merge(['estado' => ['A']]); }
```

Regra de negócio: **por omissão só são visíveis doentes activos na lista de espera** — situações de entrada/reentrada e estado `A`. Doentes operados, cancelados ou em estados finais estão escondidos.

**Efeito colateral não intencional:** o botão "Limpar" do frontend (`Index.tsx:185-201`) envia um pedido **sem parâmetros**, o que reactiva os defaults. **É impossível ver a lista completa a partir da UI** — para ver um doente operado é preciso seleccionar explicitamente essa situação no dropdown. [CONFIRMADO]

**Detalhe técnico sobre `estado`:** o default é o array `['A']`, mas o filtro usa `where('estado', $request->estado)`. O Laravel aplica `flattenValue()` ao binding, o que reduz o array ao primeiro elemento — funciona por acidente, e um dia com múltiplos estados silenciosamente ignoraria os restantes. [CONFIRMADO — comportamento de `Illuminate\Database\Query\Builder::where`]

**Ausência de filtro por equipa [CONFIRMADO]:** ao contrário de `equipaOptions` e `slotsDisponiveis`, a query principal **não é restrita à equipa do utilizador**. Qualquer utilizador com `waiting_list.view` vê **todos os doentes de todos os serviços**. A `WaitingListPolicy::view()` (que restringiria) nunca é chamada na listagem — só `viewAny()`. Ver `05-autenticacao-e-autorizacao.md`.

### 1.2 Actualizar situação interna — `POST /waiting-list/{id}/situacao-interna`

[CONFIRMADO — `WaitingListController::updateSituacaoInterna():289-304`]

```
Input: { situacao_interna }
  ├─ Validação: required + Rule::in(ResultadoChamada::getAll())
  ├─ WaitingList::findOrFail($id)            ← 404 se não existir
  ├─ $doente->situacao_interna = valor       ← atribuição directa (não está em $fillable)
  ├─ $doente->save()
Output: back() + toast 'Observações atualizadas' (título incorrecto — copiado de outro método)
```

**Ausência total de autorização [CONFIRMADO]:** a rota está declarada na linha 96 de `routes/web.php`, **fora do grupo `middleware(['auth'])`** (que fecha na linha 89). Não há `auth`, não há `permission:`, não há `$this->authorize()`. **Qualquer pessoa na Internet pode alterar a situação interna de qualquer doente**, conhecendo apenas o id. Ver `05 § Segurança`.

**Sem regra de transição:** qualquer valor do enum pode substituir qualquer outro. Não há máquina de estados aplicada. Um doente `Agendado` pode voltar a `Ativo` sem qualquer verificação.

**Efeito lateral no domínio:** `situacao_interna` controla o botão "Convocar" na UI (`Index.tsx:517` — `disabled={i.situacao_interna != 'Ativo'}`). Mudar manualmente para `Ativo` reabre a possibilidade de convocar, contornando o fluxo de chamadas.

### 1.3 Observações da secretaria — `PUT /waiting-lists/{waitingList}/observacoes-gerais`

[CONFIRMADO — `WaitingListController::updateObservacoesGerais():272-287`]

```
Input: { observacoes_secretaria }
  ├─ Middleware: permission:waiting_list.manage
  ├─ authorize('update', $waitingList) → WaitingListPolicy::update
  ├─ Validação: nullable|string   (sem limite de tamanho)
  ├─ $waitingList->update($data)
Output: back() + toast sucesso
```

**Nome enganador:** a rota, o método e o modal chamam-se "observações gerais", mas o campo escrito é `observacoes_secretaria`. O campo `observacoes_gerais` (que vem do Excel) **nunca é editável** — só sobrescrito pelo import. [CONFIRMADO]

Na listagem, a UI concatena os dois campos numa linha extra sem os distinguir: `{i.observacoes_gerais} {i.observacoes_secretaria}` (`Index.tsx:532`). [CONFIRMADO]

### 1.4 Registo de contacto administrativo — `POST /waiting-lists/{waitingList}/admin`

[CONFIRMADO — `WaitingListController::updateAdmin():150-179`]

```
Input: { contactado?, data_contacto, contactado_por, contact_result, observacoes? }
  ├─ Middleware: permission:waiting_list.manage
  ├─ authorize('update', $waitingList)
  ├─ Validação: contactado boolean | data_contacto required date
  │             contactado_por required string max:255 | contact_result required string
  │             observacoes nullable string
  ├─ (1) WaitingListContact::create(...)     ← histórico imutável
  ├─ (2) $waitingList->admin()->update($data) ← estado corrente
Output: back() + toast 'Contacto registado'
```

**Passo (2) está partido [CONFIRMADO]:**
- `$data` contém `contact_result`, coluna **inexistente** em `waiting_list_admin` → erro SQL "Unknown column". Ver `08 § B-02`.
- Mesmo sem esse problema, `admin()->update()` sobre uma relação `hasOne` sem registo existente **actualiza 0 linhas e devolve 0 sem erro** — o registo administrativo nunca é criado. Não há `updateOrCreate`. [CONFIRMADO]

**Não transaccional:** (1) e (2) não estão numa transacção. Como (2) rebenta sempre, o contacto de (1) fica gravado e o utilizador recebe erro 500 — mas ao recarregar vê o contacto no histórico. Estado inconsistente e confuso.

**`contactado` nunca é forçado a `true`:** a validação é `boolean` (não `required`) e o frontend (`AdminObservacoesModal.tsx:39-44`) **não envia o campo**. A flag `contactado` fica sempre no default `false`, mesmo depois de registados vários contactos. [CONFIRMADO]

### 1.5 Exportação — `GET /waiting/export`

[CONFIRMADO — `WaitingListController::export():241-270`]

```
Input: query params (num_processo, des_diagnostico, situacao[], estado)
  ├─ abort_unless(user->can('waiting_list.export'), 403)   ← dupla verificação (também no middleware)
  ├─ R-EX1. Se NÃO for admin nem secretaria → where('equipa_id', user->team_id)
  ├─ Filtros opcionais (SEM os defaults de situacao/estado da listagem)
  ├─ $data = $query->get()   ← sem paginação
Output: download 'lista_espera.xlsx' com 10 colunas
```

**R-EX1 está partida [CONFIRMADO]:** `equipa_id` não existe → **erro SQL para qualquer utilizador que não seja admin nem secretaria**. Na prática, apenas admin e secretaria conseguem exportar. Ver `08 § B-01`.

**Divergência de filtros:** o export **não aplica** os defaults de `situacao`/`estado` da listagem. O Excel exportado contém doentes que não estavam visíveis no ecrã. Além disso, o frontend envia `prioridade` (`Index.tsx:209`) mas o backend **não a lê** no export. [CONFIRMADO]

**Cabeçalhos vs dados desalinhados [CONFIRMADO — `WaitingListExport.php`]:** a 10.ª coluna de dados é `nome_clinico` mas o cabeçalho diz `'Médico'`; as restantes 9 correspondem. Menor, mas real.

**Dados pessoais:** o export inclui `num_processo` e diagnóstico. Não inclui `nome`. Não há registo de auditoria de quem exportou. [CONFIRMADO]

---

## M3. Convocatórias (Chamadas)

Fluxo de negócio central: a **equipa cirúrgica** pede que um doente seja contactado; a **secretaria** faz o contacto e regista o desfecho, que passa a ser a `situacao_interna` do doente.

### 3.1 Pedir chamada — `POST /waiting-list/{id}/pedir-chamada`

[CONFIRMADO — `WaitingListCallController::pedirChamada():15-47`]

```
Input: { data_pretendida, tipo_chamada, observacoes? }
  │
  ├─ ⚠ SEM middleware auth, SEM permission, SEM policy
  │
  ├─ Validações:
  │     data_pretendida  required|date|after:today   ← estritamente futura
  │     tipo_chamada     required|string             ← enum TipoChamada NÃO é usado
  │     observacoes      nullable
  │
  ├─ WaitingList::findOrFail($id)                    ← 404 se não existir
  │
  ├─ R-CH1. GUARDA DE ESTADO:
  │     se $doente->call existe E call->estado_novo ∈ ['Suspenso','Agendado','Operado']
  │         → back()->with('error', 'Doente não pode ser chamado.')   (mensagem invisível na UI)
  │
  ├─ INSERT waiting_list_calls {
  │       waiting_list_id, pedido_por_user_id = auth()->id(), pedido_em = now(),
  │       tipo_chamada, data_pretendida, observacoes_pedido,
  │       estado_novo = 'Suspenso',
  │       created_at, updated_at
  │   }
  │   (resultado, estado_anterior, data_agendada, secretaria_* ficam NULL)
  │
Output: back() + toast 'Convocatória criada com sucesso'
        descrição: 'Doente colocado em suspensão e pedido enviado à secretaria.'
```

**Problemas de correcção desta regra [CONFIRMADO]:**

| # | Problema |
|---|---|
| 1 | **`waiting_list.situacao_interna` NÃO é alterado.** O toast afirma que o doente "foi colocado em suspensão", mas a coluna do doente continua `Ativo`. O único sítio onde "Suspenso" existe é `waiting_list_calls.estado_novo`. |
| 2 | Como `situacao_interna` continua `Ativo`, o botão "Convocar" da UI (`disabled={situacao_interna != 'Ativo'}`) **continua activo** — o utilizador pode pedir a mesma chamada repetidamente. |
| 3 | A guarda R-CH1 usa `$doente->call`, que é `hasOne` sem ordenação → devolve a chamada **mais antiga**, não a mais recente. Depois de a secretaria responder à primeira chamada (`estado_novo` passa a, p.ex., `'Recusou'`), a guarda deixa de bloquear para sempre. |
| 4 | `'Suspenso'` e `'Operado'` **não existem** no enum `ResultadoChamada`. São strings mágicas só neste método. |
| 5 | Sem autenticação, `auth()->id()` devolve `null` — a coluna é nullable, portanto grava-se uma convocatória **sem autor**. |
| 6 | O `->with('error', ...)` do bloqueio **não é lido pelo frontend** → a UI mostra sucesso mesmo quando o pedido é recusado. |
| 7 | `tipo_chamada` aceita qualquer string. O enum `App\Enum\TipoChamada` existe e nunca é referenciado em lado nenhum. |

**Frontend correspondente [CONFIRMADO — `WaitingList/Index.tsx:605`]:**
```jsx
<PedirChamadaModal open={modalAbertoPedirChamadaModal} onClose={...} doente={doenteSelecionado} />
```
A prop `open` recebe a **função** `modalAbertoPedirChamadaModal` em vez do estado booleano `modalAberto`. Uma função é sempre truthy, portanto o guard `if (!open || !doente) return null` passa a depender apenas de `doente`. O estado `modalAberto` é escrito mas nunca lido. Funciona por acidente. Ver `08 § B-16`.

Além disso, `setDoenteSelecionado(doente)` recebe `i.id` (um número), não o objecto — daí o modal mostrar "Pedir Chamada para 1234" em vez do nome. [CONFIRMADO — `Index.tsx:516` vs `PedirChamadaModal.tsx:52`]

### 3.2 Resposta da secretaria — `POST /waiting-list/chamada/{callId}/resposta`

[CONFIRMADO — `WaitingListCallController::respostaChamada():49-84`]

```
Input: { resultado, data_agendada?, observacoes? }
  │
  ├─ ⚠ SEM middleware auth, SEM permission, SEM policy
  │
  ├─ Validações:
  │     resultado      required + Rule::enum(ResultadoChamada)
  │     data_agendada  required_if:resultado,Agendado | nullable | date
  │                    (⚠ sem 'after:today' — aceita datas passadas)
  │     observacoes    nullable|string
  │
  ├─ SELECT waiting_list_calls WHERE id = $callId
  │     não existe → back()->with('error', ...)   (invisível na UI)
  │
  ├─ (1) UPDATE waiting_list_calls SET
  │         secretaria_user_id = auth()->id(), secretaria_em = now(),
  │         estado_anterior = <estado_novo actual>,
  │         estado_novo = <resultado>,
  │         data_agendada, observacoes_secretaria, updated_at
  │       ⚠ a coluna `resultado` NÃO é escrita
  │
  ├─ (2) WaitingList::findOrFail($call->waiting_list_id)
  ├─ (3) $doente->situacao_interna = $request->resultado ; save()
  │
Output: back() + toast 'Sucesso'
```

**Regras e consequências:**

| # | Regra | Estado |
|---|---|---|
| R-CH2 | O `resultado` da chamada torna-se a `situacao_interna` do doente | [CONFIRMADO] — é o único ponto onde ambos os conceitos se ligam |
| R-CH3 | O estado anterior da chamada é preservado em `estado_anterior` | [CONFIRMADO] — mas apenas 1 nível de histórico; a 2.ª resposta perde o valor original |
| R-CH4 | `data_agendada` é obrigatória se `resultado = 'Agendado'` | [CONFIRMADO] |
| B | `resultado` nunca escrito → `chamadasPendentes` nunca filtra nada | [CONFIRMADO] — ver `08 § B-03` |
| B | Resposta **repetível sem limite** — não há verificação de que a chamada já foi respondida | [CONFIRMADO] |
| B | Passos (1) e (3) não são transaccionais | [CONFIRMADO] |
| B | `data_agendada` da chamada **não cria** nenhum `Schedule` nem escreve `waiting_list.data_agenda` | [CONFIRMADO] — o agendamento real é um fluxo completamente separado |

**Divergência de campo no frontend [CONFIRMADO]:** `ChamadasPendentes.tsx:100` calcula `jaRespondida` usando `c.data_agenda`, mas a coluna chama-se `data_agendada`. A expressão `!!c.estado_novo` já é sempre `true` (é sempre pelo menos `'Suspenso'`), pelo que o botão mostra sempre "Editar", nunca "Responder".

### 3.3 Listagem de pendentes — `GET /waiting-list/chamadas/pendentes`

[CONFIRMADO — `WaitingListCallController::chamadasPendentes():87-103`]

```
  ├─ ⚠ SEM auth, SEM permission
  ├─ SELECT * FROM waiting_list_calls WHERE resultado IS NULL ORDER BY pedido_em ASC
  ├─ Para CADA chamada:  +1 query ao doente  +1 query ao utilizador   ← N+1
Output: Inertia 'WaitingList/ChamadasPendentes' { chamadas, resultados }
```

- `resultado` nunca é escrito → devolve **todo o histórico de convocatórias**, não apenas as pendentes.
- N+1 de 2 queries por linha, sem eager loading.
- **Exposição pública de dados clínicos:** nome do doente, diagnóstico, tipo de convocatória e observações são servidos sem qualquer autenticação. A entrada no menu lateral também não tem restrição de permissão (`app-sidebar.tsx:27-31`). Ver `05 § Segurança`.
- Filtros de tipo e data são aplicados **apenas no cliente** (`ChamadasPendentes.tsx:23-27`) sobre o conjunto completo já enviado.

---

## M4. Blocos Operatórios (Slots)

### 4.1 Listagem — `GET /slots`

[CONFIRMADO — `SlotController::index():14-39`]

```
  ├─ authorize('viewAny', Slot::class) → requer slots.view
  ├─ R-SL1. VISIBILIDADE:
  │     admin ou secretaria → todos os slots
  │     restantes           → WHERE team_id = user.team_id OR swapped_to_team_id = user.team_id
  │                           (vê os seus e os que lhe foram cedidos por troca)
  ├─ teams: todas, ou só a do utilizador se não for admin/secretaria
Output: Inertia 'Slots/Index' { slots, teams }
```

### 4.2 Criação com repetição — `POST /slots`

[CONFIRMADO — `SlotController::store():41-94`]

```
Input: { data, hora_inicio, hora_fim, team_id, sala?, repeat_type, repeat_until? }
  ├─ authorize('create', Slot::class) → requer slots.create
  ├─ Validações:
  │     data required|date | hora_inicio required | hora_fim required
  │     team_id required|exists:teams,id | sala nullable|string
  │     repeat_type required|in:none,daily,weekly,monthly
  │     repeat_until nullable|date
  │
  ├─ Slot::create($data)                    ← slot base
  │
  ├─ R-SL2. Se repeat_type = 'none' → termina
  │
  └─ R-SL3. GERAÇÃO DA SÉRIE:
        $date = data inicial
        while (true) {
            $date->addDay() | addWeek() | addMonth()   conforme repeat_type
            if ($date->gt($data['repeat_until'])) break;
            Slot::create([...$data, 'data' => $date]);
        }
Output: back()->with('success', ...)   ← flash não lido pelo frontend
```

**Validações de negócio em falta [CONFIRMADO]:**

| # | Ausência | Consequência |
|---|---|---|
| 1 | `hora_fim > hora_inicio` | Slot com duração negativa é aceite. |
| 2 | Formato de `hora_inicio`/`hora_fim` (`required` apenas) | Qualquer string passa; falha depois no SGBD ou grava lixo. |
| 3 | `repeat_until` obrigatório quando `repeat_type ≠ 'none'` | Ver risco abaixo. |
| 4 | `repeat_until > data` | — |
| 5 | Limite máximo de slots gerados | Sem tecto. |
| 6 | Sobreposição de slots na mesma sala/horário | Duplo agendamento da mesma sala é possível. |
| 7 | `data` no passado | Aceite. |
| 8 | Equipa `ativa = true` | Slots podem ser atribuídos a equipas inactivas. |

**Risco do ciclo `while(true)` [CONFIRMADO — linhas 71-91]:**
`$date->gt($data['repeat_until'])` com `repeat_until = null`: o Carbon interpreta `null` como "agora". Se `data` for futura, o ciclo termina na 1.ª iteração (comportamento inofensivo). **Se `data` for passada** e `repeat_type = 'daily'` com `repeat_until` nulo, o ciclo cria **um slot por dia desde essa data até hoje** — potencialmente milhares de INSERTs num único request, sem transacção. [INFERIDO a partir do comportamento documentado do Carbon com `null`]

**Perda de metadados de repetição:** como visto em `02 § 3.6`, `repeat_type` e `repeat_until` não estão em `$fillable` → **nenhum slot criado regista que pertence a uma série**. Não há como editar ou apagar a série em conjunto; cada ocorrência é um registo independente e órfão. [CONFIRMADO]

**Variável morta:** `$created = 1` (linha 67) nunca é usada; `$date` é inicializado duas vezes (linhas 66 e 69). [CONFIRMADO]

### 4.3 Actualização — `PUT /slots/{slot}`

[CONFIRMADO — `SlotController::update():97-113`]

- `authorize('update', $slot)` → `SlotPolicy::update` (ver `05`).
- Valida `observacoes` — coluna que **não existe** na tabela `slots` nem em `$fillable`. Validada e descartada. [CONFIRMADO]
- **Não permite alterar `repeat_type`/`repeat_until`** (também não estão em `$fillable`).
- **Não valida** se o slot tem agendamentos antes de mudar de data/equipa — os `schedules` seguem o slot cegamente, podendo transferir cirurgias de doentes para outra equipa ou outro dia sem aviso. [CONFIRMADO — ausência de verificação]

### 4.4 Remoção — `DELETE /slots/{slot}`

[CONFIRMADO — `SlotController::destroy():115-122`]

- `authorize('delete', $slot)` → `SlotPolicy::delete`.
- **Sem verificação de agendamentos associados.** A FK `schedules.slot_id` é RESTRICT → apagar um slot com agendamentos lança `QueryException` (erro 500 não tratado). O frontend (`Slots/Index.tsx:115`) chama `router.delete` **sem confirmação do utilizador**. [CONFIRMADO]

### 4.5 Trocas entre equipas — funcionalidade não implementada

As colunas (`is_swapped`, `swapped_to_team_id`, `swap_requested_by`, `swap_approved_by`, `swap_reason`) e as regras de autorização (`SlotPolicy::requestSwap`, `SlotPolicy::approveSwap`, com a permissão `schedules.move`) **existem**, mas:

- Não há endpoint, controller nem página que permita pedir ou aprovar uma troca. [CONFIRMADO]
- Os campos só são escritos pelo `SlotSeeder:44-60`.
- A lógica de leitura já está implementada: `SlotPolicy::schedule()` e `SchedulePolicy::create()` desviam a propriedade do slot para `swapped_to_team_id` quando `is_swapped = true`.

**Regra de negócio (implementada apenas no lado da leitura) [CONFIRMADO]:**
> Quando um slot está trocado, quem pode agendar nele é a **equipa que o recebeu**, não a proprietária. Mas quem pode **pedir** ou **aprovar** a troca continua a ser a equipa proprietária (o líder, no caso da aprovação).

---

## M5. Agendamentos (Schedules)

### 5.1 Criar agendamento — `POST /waiting-lists/{waitingList}/schedule`

[CONFIRMADO — `WaitingListController::storeSchedule():181-212`]

```
Input: { slot_id, duracao_estimada?, estado, pernoita }
  │
  ├─ Middleware da rota: permission:schedules.create
  ├─ authorize('update', $waitingList) → WaitingListPolicy::update → requer waiting_list.manage
  │
  ├─ Validações:
  │     slot_id           required|exists:slots,id
  │     duracao_estimada  nullable|integer|min:1
  │     estado            required|string        ← ⚠ SEM validação de enum
  │     pernoita          required|string|in:sim,nao,talvez
  │
  ├─ Slot::findOrFail($data['slot_id'])
  ├─ R-SC1. abort(403) se ! user->can('schedule', $slot)  → SlotPolicy::schedule
  │
  ├─ Schedule::create([... 'user_id' => Auth::id() ...])
  │     ⚠ o boot 'creating' do model sobrepõe user_id com auth()->id()
  │
Output: back() + toast 'Agendamento criado'
```

**Regra de dupla autorização e o seu efeito real [CONFIRMADO]:**

A criação exige **três** condições cumulativas:
1. `schedules.create` (middleware da rota),
2. `waiting_list.manage` (via `WaitingListPolicy::update`),
3. `SlotPolicy::schedule` — que por sua vez exige de novo `schedules.create` **e** propriedade do slot.

Cruzando com o `RolesSeeder`:

| Role | `schedules.create` | `waiting_list.manage` | Pode agendar? |
|---|---|---|---|
| `admin` | ✅ (todas) | ✅ | **Sim** |
| `secretaria` | ❌ | ✅ | **Não** |
| `team_leader` | ❌ | ❌ | **Não** |
| `team_member` | ❌ | ❌ | **Não** |

→ **Na configuração de raiz, apenas o administrador consegue agendar uma cirurgia.** Toda a lógica de propriedade de equipa em `SlotPolicy::schedule` e `SchedulePolicy::create` é, na prática, inalcançável — o admin passa sempre no atalho `isAdmin()`. Ver `05` e `08 § B-17`.

**`estado` não validado:** `required|string` aceita qualquer valor. Um valor fora de `ScheduleEstadoTypes` grava-se na BD (a coluna é `string` livre) e depois faz `ScheduleEstadoTypes::from()` lançar `ValueError` no accessor `estado_cor`, **rebentando qualquer página que carregue esse schedule** (agenda, slot modal, lista de espera). [CONFIRMADO — `Schedule.php:49-52`]

**Sem regras de capacidade [CONFIRMADO]:** não há verificação de que
- a soma de `duracao_estimada` dos schedules cabe no intervalo `hora_inicio`–`hora_fim` do slot;
- o doente já não está agendado noutro slot;
- o doente não está já operado ou cancelado;
- o slot é futuro.

Nenhuma destas regras existe. `duracao_estimada` é registada mas **nunca usada em cálculo algum** — apenas exibida.

### 5.2 Actualizar agendamento — `PUT /waiting-lists/{waitingList}/schedule/{schedule}`

[CONFIRMADO — `WaitingListController::updateSchedule():214-238`]

Igual ao anterior, com duas diferenças:
- Middleware da rota: `permission:schedules.edit`.
- Guarda adicional: `abort(403)` se `!can('schedule', $slot) || !can('schedules.edit')`.

**Falha de verificação de coerência [CONFIRMADO]:** o `{schedule}` é resolvido por route-model binding **sem verificar que pertence ao `{waitingList}` da URL**. Um utilizador autorizado pode enviar `PUT /waiting-lists/999/schedule/123` onde o schedule 123 é de outro doente — a policy é avaliada contra o doente 999, mas o UPDATE aplica-se ao schedule 123. Ver `08 § B-18`.

**Cancelamento é um update [CONFIRMADO — `EditScheduleModal.tsx:111-124`]:** o botão "Cancelar" envia um `PUT` com `estado: 'cancelado'` **omitindo `pernoita`** — que é `required|string|in:...` → a validação falha e o cancelamento nunca funciona pela UI. Ver `08 § B-19`.

**Não existe DELETE de agendamento.** `SchedulePolicy::delete()` está implementada mas nenhuma rota a invoca. O cancelamento lógico (estado `cancelado`) é o único mecanismo previsto. [CONFIRMADO]

---

## M6. Agenda

Três vistas + exportação PDF. Todas partilham a mesma regra de composição.

### 6.1 Regra transversal — schedules visíveis

[CONFIRMADO — `AgendaController:36-38,68-69,112-113,165-166`]

```php
'schedules' => fn($q) => $q->where('estado', '!=', 'cancelado')->with('waitingList')
```
> **R-AG1:** agendamentos cancelados nunca aparecem na agenda nem no PDF, em nenhuma vista.

### 6.2 `GET /agenda` (vista de slots)

[CONFIRMADO — `AgendaController::index():65-102`]

- Middleware `permission:agenda.view`.
- **Sem filtro de data** — carrega **todos os slots de sempre**, com schedules e doentes. Cresce indefinidamente.
- Agrupa por `data` normalizada (`Carbon::parse($slot->data)->toDateString()`).
- Calcula `teamColors` atribuindo cores de uma paleta de 10 por **índice de iteração**: `$palette[$index % 10]`.

**R-AG2 — instabilidade das cores [CONFIRMADO]:** a cor é atribuída pelo índice na colecção `Team::all()` (ordem de inserção), não pela coluna `teams.cor`. Apagar ou criar uma equipa **reatribui as cores de todas as seguintes**. Além disso, `Agenda/Semana.tsx:156-157` usa `slot.team.cor` (a coluna) enquanto `SlotModal.tsx:24` usa `teamColors[slot.team_id]` (a paleta) — **dois esquemas de cor incompatíveis no mesmo ecrã**. Ver `08 § B-20`.

### 6.3 `GET /agenda/semana` e `GET /agenda/mensal`

[CONFIRMADO — `AgendaController::semana():104-153`, `mensal():155-210`]

| Vista | Intervalo calculado |
|---|---|
| Semana | `Carbon::parse(start ?? now())->startOfWeek(MONDAY)` → `endOfWeek(SUNDAY)` |
| Mensal | `startOfMonth()->startOfWeek(MONDAY)` → `endOfMonth()->endOfWeek(SUNDAY)` (grelha completa, inclui dias adjacentes) |

**R-AG3 — doentes disponíveis para agendar [CONFIRMADO — linhas 146-148 / 201-203]:**
```php
WaitingList::whereDoesntHave('schedules', fn($q) => $q->whereIn('estado', ['agendado','confirmado']))
           ->orderBy('num_processo')->get()
```
- Um doente só é oferecido para agendamento se não tiver nenhum schedule em estado `agendado` ou `confirmado`.
- **`'confirmado'` não existe** em `ScheduleEstadoTypes` (`proposto`, `pronto`, `agendado`, `operado`, `cancelado`) — é uma condição sempre falsa.
- Estados **não excluídos**: `proposto`, `pronto`, `operado`. Um doente já operado continua a aparecer como disponível para novo agendamento.
- **Sem limite nem paginação** — carrega toda a lista de espera não agendada em cada abertura da agenda. Ver `08 § B-21`.

**Frontend da vista semanal [CONFIRMADO — `Agenda/Semana.tsx:45-65`]:** apenas segunda a sexta são renderizadas. Slots criados ao sábado ou domingo **existem na BD, são devolvidos pelo backend e nunca são mostrados**.

### 6.4 `GET /agenda/export/pdf`

[CONFIRMADO — `AgendaController::exportPdf():16-63`]

- Middleware `permission:agenda.export`.
- `type=mensal|semana` (default `semana`).
- Mesma regra R-AG1 (exclui cancelados).
- A4 landscape, DomPDF.
- Nome do ficheiro: `agenda_mensal_YYYY_MM.pdf` ou `agenda_semanal_YYYY_MM_DD_a_YYYY_MM_DD.pdf`.
- **Sem tratamento de erro de parsing de datas:** `Carbon::parse($request->get('start'))` com um valor inválido lança `InvalidFormatException` → 500. [CONFIRMADO]

---

## M7. Equipas

[CONFIRMADO — `TeamController`]

| Operação | Rota | Autorização | Notas |
|---|---|---|---|
| Listar | `GET /teams` | `teams.view` + `TeamPolicy::viewAny` | Não-admin/secretaria só vê a sua equipa (equipas **e** utilizadores filtrados). |
| Criar | `POST /teams` | `teams.manage` + `TeamPolicy::create` | Valida `sala_default` (campo inexistente). |
| Actualizar | `PUT /teams/{team}` | `teams.manage` + `TeamPolicy::update` | Líder pode editar a sua equipa. |
| Apagar | `DELETE /teams/{team}` | `teams.manage` + `TeamPolicy::delete` (**só admin**) | Sem verificação de dependências → FK RESTRICT → 500 se houver membros/slots/doentes. |
| Actualizar membros | *(sem rota)* | — | Método implementado mas inalcançável. |

**Regras de validação [CONFIRMADO — `TeamController:46-52`]:** `nome` required max 255; `cor` **required** string max 20 (apesar de a coluna ser nullable); `ativa` required boolean; `leader_id` nullable exists.

**Dupla fonte de verdade para o líder [CONFIRMADO]:** `teams.leader_id` pode ser definido em dois sítios sem coordenação:
- `TeamController::store/update` (campo `leader_id` do formulário de equipa),
- `UserController::store/update` (linhas 55-57 e 90-92) — atribuir a role `team_leader`/`lider` a um utilizador **sobrescreve** o `leader_id` da equipa.

Promover um segundo líder na mesma equipa substitui o primeiro **sem qualquer aviso**, e o utilizador anterior mantém a role `team_leader` — passa a haver dois líderes por role e um só por `leader_id`. Ver `08 § B-22`.

---

## M8. Utilizadores

[CONFIRMADO — `UserController`]

### 8.1 Criar — `POST /users`

```
Input: { name, email, password, role, team_id? }
  ├─ Middleware: permission:users.manage
  ├─ ⚠ SEM policy (não existe UserPolicy)
  ├─ Validações: name required max:255 | email required|email|unique:users
  │              password required|min:6      ← ⚠ mais fraco que Password::defaults()
  │              role required|exists:roles,name | team_id nullable|exists:teams,id
  │
  ├─ R-U1. Se role ∈ {team_member, team_leader, membro, lider} e team_id vazio
  │           → withErrors(['team_id' => 'Utilizadores de equipa precisam de equipa associada.'])
  │
  ├─ User::create({name, email, password: bcrypt(...), team_id})   ← ⚠ 'role' NÃO incluído
  ├─ $user->assignRole($data['role'])
  ├─ R-U2. Se role ∈ {team_leader, lider} e team_id → Team::update(['leader_id' => $user->id])
Output: redirect users.index
```

**R-U1 [CONFIRMADO]:** utilizadores de equipa (membro ou líder, em qualquer das duas nomenclaturas) **têm de** ter equipa. `admin` e `secretaria` podem ficar sem equipa.

**Inconsistência de força de password [CONFIRMADO]:** aqui `min:6`; no registo público e no reset, `Rules\Password::defaults()` (8 caracteres por omissão do Laravel). Um administrador pode criar contas mais fracas do que o utilizador criaria para si próprio.

**`role` não é persistido na coluna [CONFIRMADO]:** `User::create()` não inclui `role` → fica o default de BD `'team_member'`, mesmo que a role Spatie atribuída seja `admin`. Como `User::isAdmin()` é `hasRole('admin') || $this->role === 'admin'`, funciona à mesma — mas a coluna fica errada e qualquer query que filtre por `users.role` (ex.: `SlotSeeder:42`) dá resultados falsos. `update()` já persiste correctamente.

### 8.2 Actualizar / Apagar / Ver

| Operação | Notas |
|---|---|
| `PUT /users/{user}` | Mesmas regras. `syncRoles([role])` — substitui todas as roles. **Não permite alterar password.** Não impede remover a própria role de admin. |
| `DELETE /users/{user}` | **Sem confirmação, sem policy, sem verificação de dependências.** Um admin pode apagar-se a si próprio. Se o utilizador for líder de equipa ou tiver criado agendamentos → FK RESTRICT → 500. |
| `GET /users/{user}` | Renderiza `Users/Show`, **página React que não existe** (`resources/js/pages/Users/` só tem Index, Create, Edit) → erro do Inertia. [CONFIRMADO] |

---

## M9. RBAC (Roles & Permissões)

[CONFIRMADO — `RolePermissionController`, rotas `/access-control/*`]

Todas as rotas são protegidas por `permission:users.manage`. **Não existem policies.** A permissão `roles.manage` é criada pelo seeder mas **nunca é verificada**; `roles.view` só é usada para mostrar o item no menu lateral. [CONFIRMADO]

| Operação | Validação | Regra de negócio |
|---|---|---|
| `POST /access-control/roles` | `name` unique em `roles`; `permissions.*` exists | `Role::findOrCreate(name,'web')` + `syncPermissions` |
| `PUT /access-control/roles/{role}` | idem, ignorando o próprio id | Substitui **todas** as permissões da role |
| `DELETE /access-control/roles/{role}` | — | **R-RB1: a role `admin` não pode ser removida** (`RolePermissionController:58-60`) — única salvaguarda de RBAC do sistema |
| `POST /access-control/permissions` | `name` unique | — |
| `PUT /access-control/permissions/{permission}` | idem | **Sem protecção**: renomear uma permissão parte silenciosamente os middlewares `permission:...` das rotas, que comparam por string |
| `DELETE /access-control/permissions/{permission}` | — | **Sem protecção**: apagar `waiting_list.view` bloqueia toda a gente da lista de espera |

**R-RB1 é insuficiente [CONFIRMADO]:** a role `admin` não pode ser apagada, mas **pode ser esvaziada** de permissões via `updateRole`, ou renomeada. Também é possível remover a role `admin` de todos os utilizadores via `UserController::update`. Não há verificação de "último administrador". Ver `08 § B-23`.

---

## M10/M11. Autenticação e Definições de conta

Starter kit Laravel padrão (Breeze/React), praticamente sem alterações. Ver `05-autenticacao-e-autorizacao.md` para o detalhe, incluindo:

- Registo público aberto (`/register`) sem atribuição de role nem equipa.
- Ausência das colunas `email_verified_at` e `remember_token` na tabela `users`, que parte o "remember me", o reset de password e a alteração de e-mail.
