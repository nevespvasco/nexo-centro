# Documentação de Business Logic — listaEspera

Documentação técnica completa da lógica de negócio do sistema de **gestão de lista de espera cirúrgica**, obtida por engenharia inversa do código-fonte.

**Data da análise:** 2026-08-08 · **Commit base:** `7445c64` (branch `main`)

---

## Por onde começar

| Se quer… | Leia |
|---|---|
| Perceber o que o sistema faz em 10 minutos | [`01-visao-geral-e-arquitetura.md`](01-visao-geral-e-arquitetura.md) |
| Perceber os dados e as suas regras de integridade | [`02-modelo-de-dados.md`](02-modelo-de-dados.md) |
| Perceber **porque** o sistema faz o que faz | [`03-business-logic.md`](03-business-logic.md) |
| Implementar ou consumir um endpoint | [`04-api-endpoints.md`](04-api-endpoints.md) |
| Perceber quem pode fazer o quê | [`05-autenticacao-e-autorizacao.md`](05-autenticacao-e-autorizacao.md) |
| Perceber os estados de um doente / agendamento | [`06-state-machines.md`](06-state-machines.md) |
| Perceber o que acontece quando algo corre mal | [`07-erros-edge-cases-e-fluxos.md`](07-erros-edge-cases-e-fluxos.md) |
| Saber o que está partido antes de mexer | [`08-inconsistencias-e-bugs.md`](08-inconsistencias-e-bugs.md) |
| Consultar uma regra específica ou um termo | [`09-matrizes.md`](09-matrizes.md) |

---

## Convenção de confiança

Todas as afirmações estão classificadas:

- **[CONFIRMADO]** — verificável directamente no código, com ficheiro e linha.
- **[INFERIDO]** — dedução a partir de nomes, seeders, UI ou comportamento documentado do framework.
- **[NÃO DETERMINÁVEL]** — não é possível concluir a partir do projecto analisado.

Nenhuma regra foi inventada. Quando o código é ambíguo, as interpretações possíveis estão listadas em [`08 § Parte B`](08-inconsistencias-e-bugs.md#parte-b--assumptions-e-ambiguidades) com indicação da mais provável e do código que a suporta.

---

## O sistema em três parágrafos

A aplicação gere a lista de espera cirúrgica de um serviço de Cirurgia (`HSA - Cirurgia`). **Não é a fonte de verdade clínica**: os doentes são importados periodicamente de um ficheiro Excel exportado do sistema hospitalar, identificados pelo `NUM_LISTA_ESPERA`. Sobre esses dados, a aplicação acrescenta uma camada interna — posicionamento na lista, situação interna, convocatórias, agendamento em blocos operatórios e agenda.

O **fluxo de negócio central** é a convocatória: uma equipa cirúrgica pede que a secretaria contacte um doente; a secretaria regista o desfecho, que passa a ser a `situacao_interna` desse doente. Em paralelo, existe um fluxo de agendamento: blocos operatórios (`slots`) são atribuídos a equipas, e doentes são colocados nesses blocos (`schedules`), ficando visíveis na agenda semanal/mensal e no PDF.

A stack é Laravel 12 + Inertia.js + React 19, com autorização via `spatie/laravel-permission`. **Não existe API JSON, camada de serviços (excepto o import), processamento assíncrono, eventos de domínio nem auditoria de acções de utilizador.**

---

## Estado do sistema — resumo executivo

O código está em desenvolvimento activo e **contém problemas estruturais que impedem partes do fluxo principal de funcionar**. Os mais relevantes, para quem for trabalhar no projecto:

### Bloqueadores funcionais

| ID | Problema | Efeito |
|---|---|---|
| [B-01](08-inconsistencias-e-bugs.md#b-01--equipa_id-vs-team_id--coluna-inexistente) | Código usa `equipa_id`; a coluna chama-se `team_id` | Exportação partida para equipas; **nenhum líder consegue editar nada** |
| [B-02](08-inconsistencias-e-bugs.md#b-02--contact_result-não-existe-em-waiting_list_admin) | `contact_result` não existe em `waiting_list_admin` | Registo de contacto administrativo dá **500 sempre** |
| [B-03](08-inconsistencias-e-bugs.md#b-03--coluna-resultado-nunca-escrita) | Coluna `resultado` nunca escrita | Lista de convocatórias pendentes **nunca esvazia** |
| [B-08](08-inconsistencias-e-bugs.md#b-08--colunas-email_verified_at-e-remember_token-inexistentes) | `email_verified_at` e `remember_token` não existem em `users` | Reset de password, "lembrar-me" e alteração de e-mail partidos; **suite de testes falha** |
| [B-12](08-inconsistencias-e-bugs.md#b-12--break-na-comparação-do-import-trunca-a-auditoria) | `break` na comparação do import | **Auditoria de alterações estruturalmente incompleta** — só o 1.º campo de cada linha é registado |
| [B-17](08-inconsistencias-e-bugs.md#b-17--a-configuração-de-permissões-torna-o-agendamento-inexecutável) | Conjunção de permissões no agendamento | **Só o admin consegue agendar uma cirurgia** na configuração de raiz |
| [B-19](08-inconsistencias-e-bugs.md#b-19--o-cancelamento-de-agendamento-nunca-funciona) | Payload de cancelamento omite `pernoita` | **Não é possível cancelar um agendamento pela interface** |
| [B-27](08-inconsistencias-e-bugs.md#b-27--três-noções-não-sincronizadas-de-doente-agendado) | Três noções não sincronizadas de "doente agendado" | Secretaria marca `Agendado` → **nenhum `Schedule` é criado** |

### Achados de segurança

| ID | Achado | Detalhe em |
|---|---|---|
| **S-1** 🔴 | **Quatro rotas de negócio sem autenticação** (`routes/web.php:91-96`) — permitem ler e escrever dados clínicos identificáveis sem credenciais | [`05 § 3.1`](05-autenticacao-e-autorizacao.md#31-achados-críticos) |
| **S-2** 🔴 | **`GET /phpinfo` público** (`routes/web.php:98`) — expõe configuração e variáveis de ambiente | idem |
| **S-3** 🟠 | `APP_DEBUG=true` por omissão | idem |
| **S-4** 🟠 | Registo público aberto, sem aprovação | idem |
| **S-5** 🟠 | Listagem da lista de espera não é filtrada por equipa | idem |

Total: **31 bugs/inconsistências** (6 críticos), **10 achados de segurança**, **12 ambiguidades** de domínio.

---

## Cobertura da análise

| Área | Coberto |
|---|---|
| Rotas | 66 endpoints (`web.php`, `auth.php`, `settings.php`) |
| Controllers | 22 (12 de domínio + 10 de auth/settings) |
| Models | 10 |
| Policies | 4 |
| Enums | 3 |
| Migrações | 18 |
| Seeders | 10 |
| Services / Imports / Exports | 4 |
| Páginas e componentes React | ~35 relevantes para lógica de negócio |
| Configuração | `bootstrap/app.php`, `config/*`, `.env.example`, `deploy.sh`, workflows de CI |
| Script Python standalone | `python/import_excel.py` (não integrado) |

**Regras de negócio catalogadas:** 84 (BR-01 … BR-84), cada uma com referência a ficheiro e linha.
